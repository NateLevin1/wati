use clap::{App, Arg};
use regex::{Regex, Captures};

const REGEX_ERR: &str = "There was an error creating the regexes.";

pub fn compile(mut file: String) -> Result<String, String> {
    // This function is really just a series of regexes.

    // TODO: support for nested inline calls. currently breaks and provides an error message
    let nested_call = Regex::new(r"call \$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*\(.*call \$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*.*\)").expect(REGEX_ERR);
    let nested = nested_call.find(&file);
    if nested.is_some() {
        return Err(String::from(format!("Cannot nest calls to functions inside calls to functions. (near ..{}..)", nested.map_or("", |m| { m.as_str() }) )));
    }

    // compile inline call
    let call_regex = Regex::new(r"call (\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) *\((.*)\)").expect(REGEX_ERR);
    file = call_regex.replace_all(&file, |caps: &Captures| {
        let name = &caps[1];
        let params: Vec<&str> = caps.get(2).map_or("()", |m| { m.as_str() }).split(",").collect();
        format!("{}\ncall {}", params.join("\n"), name)
    }).to_string();


    // match params without (param: ($abc i32)
    let match_params = Regex::new(r"\((?P<var_name>\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (?P<var_type>i32|i64|f32|f64)\)").expect(REGEX_ERR);
    file = match_params.replace_all(&file, "(param $var_name $var_type)").to_string();

    // match locals without (local: (l$abc i32)
    let match_locals = Regex::new(r"\(l ?(?P<var_name>\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]*) (?P<var_type>i32|i64|f32|f64)\)").expect(REGEX_ERR);
    file = match_locals.replace_all(&file, "(local $var_name $var_type)").to_string();

    // match numeric literals: 5i32
    let match_constants = Regex::new(r"(?P<num>\d*\.?\d+)(?P<type>(?:i|f)(?:32|64))").expect(REGEX_ERR);
    file = match_constants.replace_all(&file, "(${type}.const $num)").to_string();

    // match getting without .get: $abc
    let match_get = Regex::new(r"((?:global|local)\.(?:set|get) |call |call_indirect |br |br_if |br_table |block |loop |if |\(\w+ )?(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]+)( *=)?").expect(REGEX_ERR);
    file = match_get.replace_all(&file, |caps: &Captures| {
        // we need to use this closure so we don't match setting too

        // caps[1] == "(param "|""; caps[1] == name; caps[2] == " ="|""
        if caps.get(1) != None || caps.get(3) != None {
            // is not a get
            format!("{}{}{}", &caps.get(1).map_or("", |m| { m.as_str() } ), &caps[2], &caps.get(3).map_or("", |m| { m.as_str() } ))
        } else {
            // is a get
            format!("(local.get {})", &caps[2])
        }
    }).to_string();

    // match setting without .set: $abc = stack or $abc = 2
    let match_set = Regex::new(r"(\$[0-9A-Za-z!#$%&'*+\-./:<=>?@\\^_`|~]+) *= *(.+)").expect(REGEX_ERR);
    file = match_set.replace_all(&file, |caps: &Captures| {
        // we need a closure because this behavior changes if `stack` is used
        // $x = 2i32; caps[1] == "$x"; caps[2] == "(i32.const 2)"
        if caps[2].trim() == "stack" {
            format!("local.set {}", &caps[1])
        } else {
            format!("(local.set {} {})", &caps[1], &caps[2])
        }
    }).to_string();
    
    Ok(file)
}

pub struct Arguments {
    pub input: String,
    pub out: String
}
pub fn get_arguments() -> Arguments {
    let matches = App::new("wati2wat").version("v1.0-beta")
        .args(&[
            Arg::with_name("input").help("the input file to be used").required(true),
            Arg::with_name("out").short("o").long("out").takes_value(true).value_name("FILE").help("the output file")
        ])
        .get_matches();
    let input = matches.value_of("input").unwrap();
    
    let mut output: Option<&str> = None;

    if matches.is_present("out") {
        output = matches.value_of("out");
    }

    let output_with_default = output.unwrap_or(&input[0..input.len() - 1]); // - 1 makes it just "wat" instead of "wati"

    Arguments {
        input: String::from(input),
        out: String::from(output_with_default)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compile_unchanged() {
        let input = String::from("(module)");
        // should remain unchanged
        assert_eq!(compile(input), "(module)");
    }
}