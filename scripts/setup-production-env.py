#!/usr/bin/env python3
"""Create a production .env with random secrets.

Usage:
  python3 scripts/setup-production-env.py --site-url https://example.com
  python3 scripts/setup-production-env.py --force --site-url https://example.com

The generated admin password is written to /root/jp-wiki-admin-secret with
mode 0600. It is not printed.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import secrets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-url", required=True)
    parser.add_argument("--mysql-port", default="3307")
    parser.add_argument("--http-port", default="127.0.0.1:8080")
    parser.add_argument("--trust-proxy", default="2")
    parser.add_argument("--admin-student-no", default="10000000")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    env_path = project_root / ".env"
    secret_path = Path("/root/jp-wiki-admin-secret")

    if env_path.exists() and not args.force:
        raise SystemExit(f"Refusing to overwrite existing {env_path}; pass --force if intended")

    jwt_secret = secrets.token_urlsafe(48)
    mysql_root_password = secrets.token_hex(24)
    mysql_password = secrets.token_hex(24)
    admin_password = secrets.token_hex(24)

    env_path.write_text(
        "\n".join(
            [
                f'JWT_SECRET="{jwt_secret}"',
                'ADMIN_COOKIE_SECURE="true"',
                "PUBLIC_QUERY_TTL_DAYS=30",
                f'MYSQL_ROOT_PASSWORD="{mysql_root_password}"',
                'MYSQL_DATABASE="campus_lostfound"',
                'MYSQL_USER="campus"',
                f'MYSQL_PASSWORD="{mysql_password}"',
                f"MYSQL_PORT={args.mysql_port}",
                f'HTTP_PORT="{args.http_port}"',
                "AUDIT_LOG_RETENTION_DAYS=365",
                f'PUBLIC_SITE_URL="{args.site_url.rstrip("/")}"',
                "RATE_LIMIT_WINDOW_MS=900000",
                "RATE_LIMIT_MAX=600",
                'ENABLE_API_DOCS="false"',
                'LOG_LEVEL="info"',
                'CORS_ORIGINS=""',
                f"TRUST_PROXY={args.trust_proxy}",
                "REQUIRE_REVIEW=true",
                "ENABLE_WHITELIST=false",
                "",
            ]
        ),
        encoding="utf-8",
    )
    secret_path.write_text(
        "\n".join(
            [
                f"ADMIN_STUDENT_NO={args.admin_student_no}",
                f"ADMIN_PASSWORD={admin_password}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    os.chmod(env_path, 0o600)
    os.chmod(secret_path, 0o600)

    for number, line in enumerate(env_path.read_text(encoding="utf-8").splitlines(), 1):
        key, _, value = line.partition("=")
        print(number, key, len(value.strip('"')))


if __name__ == "__main__":
    main()
