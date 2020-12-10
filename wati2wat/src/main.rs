use std::fs;
mod lib;

fn main() {
    let args = lib::get_arguments();
    let input = fs::read_to_string(args.input).expect("An error occurred while trying to read the file");
    let compiled_input = lib::compile(input);
    fs::write(&args.out, compiled_input).expect("There was an error writing to the file");
    println!("Compiled successfully and wrote to \"{}\"", args.out);
}
