//! Termax 桌面应用入口
//! 禁止在 release 模式下显示控制台窗口。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  termax_lib::run();
}
