from collections.abc import Callable
from pathlib import Path
import secrets


ROOT = Path(__file__).resolve().parents[1]


def create_env_file(
    template: Path,
    destination: Path,
    generated_values: dict[str, Callable[[], str]],
) -> None:
    if destination.exists():
        return

    remaining_keys = set(generated_values)
    output_lines: list[str] = []

    for line in template.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key in generated_values and value == "":
            output_lines.append(f"{key}={generated_values[key]()}")
            remaining_keys.remove(key)
        else:
            output_lines.append(line)

    if remaining_keys:
        missing = ", ".join(sorted(remaining_keys))
        raise ValueError(f"Missing empty placeholders in {template}: {missing}")

    content = "\n".join(output_lines) + "\n"

    try:
        with destination.open("x", encoding="utf-8", newline="\n") as file:
            file.write(content)
    except FileExistsError:
        return


def main() -> None:
    create_env_file(
        ROOT / "backend/.env.development.example",
        ROOT / "backend/.env.development",
        {"DJANGO_SECRET_KEY": lambda: secrets.token_urlsafe(64)},
    )
    create_env_file(
        ROOT / "frontend/.env.development.example",
        ROOT / "frontend/.env.development",
        {"SESSION_SECRET": lambda: secrets.token_urlsafe(48)},
    )


if __name__ == "__main__":
    main()
