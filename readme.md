# CORA

<sup>_Container Orchestration via Runc Application_</sup>

## Overview

CORA is a Deno-based application that provides a simple HTTP service to manage container images on Linux systems. It
currently utilizes `skopeo` and `umoci` to handle container operations such as listing, pulling, and deleting images.
Future updates will integrate `runc` as the container runtime to manage container execution directly.

## Features

- **Web Interface:** Manage container images through a user-friendly web interface.
- **Container Image Management:** List, pull, and delete container images directly from the UI.
- **Secure:** Built on Deno, which emphasizes security.
- **Future Integration:** Plans to incorporate `runc` for container runtime management.

## Getting Started

### Prerequisites

- Deno
- `skopeo`
- `umoci`
- `runc` (for future use)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/anluin/cora.git
   ```
2. Navigate to the project directory:
   ```bash
   cd cora
   ```

### Starting the Application

To start CORA, you need to run the Deno script with elevated privileges due to the nature of container management. Use
the provided script to handle this:

```sh
./scripts/sudo_deno.sh run --allow-write=/var/lib/cora --allow-read=/var/lib/cora,public --allow-net=127.0.0.1:8042 --allow-run=skopeo,umoci ./src/main.ts
```

This command executes the main Deno script with all necessary permissions, ensuring that CORA can manage container
images effectively.

### Usage

Once the application is running, open your web browser and navigate to `http://localhost:8042`. You will be presented
with the CORA web interface where you can manage container images.

## Development

- **Run Tests:**

```sh
./scripts/sudo_deno.sh test --allow-write=/tmp --allow-read=/tmp,public --allow-net=127.0.0.1:8042 --allow-run=skopeo,umoci
```

- **Scripts:**
    - `sudo_deno.sh`: Run Deno with elevated privileges to manage containers.
    - `cd_deno.sh`: Helper script for changing directory context when running Deno with elevated privileges.

## Future Plans

- **Integration with `runc`:**<br/>
  We plan to integrate `runc` to manage container execution directly from CORA, enhancing
  its capabilities to not just manage images but also run containers securely and efficiently.
