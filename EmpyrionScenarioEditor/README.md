# 🌌 Empyrion Scenario Editor

[![Platform](https://img.shields.io/badge/Platform-Linux-blue?style=for-the-badge&logo=linux)](https://www.linux.org/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-green?style=for-the-badge&logo=python)](https://www.python.org/)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange?style=for-the-badge)](https://github.com/chaosz5050/empyrion-tools/tree/main/EmpyrionScenarioEditor)
[![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-red?style=for-the-badge)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

A web-based scenario editor for Empyrion Galactic Survival. Edit scenario files, configure game options, and manage galaxy settings through an intuitive web interface.

## ✨ Features

- **Scenario File Management** - Edit and view scenario configuration files
- **Game Options Editor** - Configure game settings through a web interface
- **Galaxy Viewer** - Visual representation of galaxy configurations
- **File Browser** - Navigate and manage scenario files easily
- **Dark Theme** - Professional dark interface for extended editing sessions
- **Real-time Editing** - Live editing with immediate feedback
- **Security Features** - Safe file handling and input validation

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Flask web framework

### Installation

```bash
# Clone the repository (or navigate to existing directory)
cd EmpyrionScenarioEditor

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### Running the Editor

```bash
# Start the web application
python app.py

# Access at http://localhost:5000
```

## 🔧 Usage

1. **Start the Application** - Run `python app.py`
2. **Open Web Browser** - Navigate to `http://localhost:5000`
3. **Browse Scenarios** - Use the file browser to navigate scenario directories
4. **Edit Files** - Click on files to edit them directly in the web interface
5. **Configure Game Options** - Use the game options manager for setting adjustments
6. **View Galaxy** - Use the galaxy viewer to visualize scenario layouts

## 📁 Project Structure

```
EmpyrionScenarioEditor/
├── app.py                  # Main Flask application
├── scenario_loader.py      # Scenario file handling
├── view_logs.py           # Log viewer utility
├── requirements.txt       # Python dependencies
├── static/                # Web assets
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript modules
│   └── images/           # Static images
├── templates/            # HTML templates
├── utils/                # Utility modules
│   ├── exceptions.py     # Custom exceptions
│   ├── logging_config.py # Logging configuration
│   └── security.py       # Security utilities
└── logs/                 # Application logs
```

## 🛡️ Security Features

- **Input Validation** - All user inputs are validated and sanitized
- **Path Traversal Protection** - Prevents access to files outside allowed directories
- **Safe File Handling** - Secure file upload and download mechanisms
- **Comprehensive Logging** - All actions are logged for audit purposes

## 📊 Logging

The application provides comprehensive logging:

- **Application Logs** - General application events and errors
- **Performance Logs** - Performance metrics and timing information
- **Error Logs** - Detailed error tracking and debugging information
- **Client Logs** - Client-side activity and user interactions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bug reports and feature requests.

## 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.

---

*Developed for the Empyrion Galactic Survival modding community*