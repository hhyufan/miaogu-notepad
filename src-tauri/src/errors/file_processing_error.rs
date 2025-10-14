/*!
 * 文件 / 文件夹处理错误定义
 *
 * @author Azuremy
 * @version 0.0.1
 */

use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FileProcessingError {
    DirectoryCreation(PathBuf, #[source] std::io::Error),
    FileCreation(PathBuf, #[source] std::io::Error),
}

impl std::fmt::Display for FileProcessingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileProcessingError::DirectoryCreation(path, e) => {
                write!(f, "Failed to create directory: '{}': {}", path.display(), e)
            }
            FileProcessingError::FileCreation(path, e) => {
                write!(f, "Failed to create file: '{}': {}", path.display(), e)
            }
        }
    }
}
