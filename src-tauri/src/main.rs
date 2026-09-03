// Prevents an additional console window on Windows in release builds. Harmless on macOS.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    audio_splitter_lib::run()
}
