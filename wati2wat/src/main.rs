use std::fs;
use colored::*;
mod lib;

fn main() {
    let args = lib::get_arguments();
    println!("\nCompiling file \"{}\"...", &args.input);
    let result_input = fs::read_to_string(&args.input);
    if result_input.is_err() {
        print_err(&format!("{}", result_input.unwrap_err()));
        std::process::exit(1);
    }
    let input = result_input.expect("An error occurred trying to read the file.");
    let compiled_input_possible_err = lib::compile(input);
    if compiled_input_possible_err.is_err() {
        print_err(&compiled_input_possible_err.unwrap_err());
        std::process::exit(1);
    }
    let compiled_input = compiled_input_possible_err.unwrap();
    fs::write(&args.out, &compiled_input).expect("There was an error writing to the file");
    print_success(&format!("Compiled successfully and wrote to \"{}\"\n", &args.out));
}

fn print_err(err: &str) {
    eprintln!("{}: {}\n", "ERR".bright_red(), err.bright_red());
}
fn print_success(msg: &str) {
    println!("{}", msg.bright_green());
}