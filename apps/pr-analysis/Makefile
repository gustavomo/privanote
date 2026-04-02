.PHONY: setup test lint format clean

VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

setup:
	python3 -m venv $(VENV)
	$(PIP) install -r requirements.txt
	$(PIP) install -e ".[dev]"

test:
	$(PYTHON) -m pytest tests/ -v

lint:
	$(VENV)/bin/ruff check src/ tests/

format:
	$(VENV)/bin/ruff format src/ tests/

clean:
	rm -rf $(VENV) __pycache__ .pytest_cache src/*.egg-info
