from collections.abc import Callable, Mapping
from pathlib import Path
import secrets


ROOT = Path(__file__).resolve().parents[1]


def create_env_file(
    source: Path,
    destination: Path,
    generated_values: Mapping[str, Callable[[], str]],
) -> None:
    if destination.exists():
        print(f"skip: {destination.relative_to(ROOT)} already exists")
        return

    lines = source.read_text(encoding="utf-8").splitlines(keepends=True)
    replaced_keys: set[str] = set()
    output: list[str] = []

    for line in lines:
        content = line.rstrip("\r\n")
        newline = line[len(content) :]
        key, separator, _ = content.partition("=")

        generator = generated_values.get(key)
        if separator and generator is not None:
            content = f"{key}={generator()}"
            replaced_keys.add(key)

        output.append(content + newline)

    missing_keys = generated_values.keys() - replaced_keys
    if missing_keys:
        missing = ", ".join(sorted(missing_keys))
        raise RuntimeError(f"missing expected environment keys in {source}: {missing}")

    destination.write_text("".join(output), encoding="utf-8")
    print(f"created: {destination.relative_to(ROOT)}")


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
