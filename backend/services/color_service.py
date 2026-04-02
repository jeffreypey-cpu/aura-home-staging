PROJECT_COLORS = [
    {"name": "Red",    "hex": "#E53E3E", "bg": "#FED7D7", "text": "#822727"},
    {"name": "Blue",   "hex": "#3182CE", "bg": "#BEE3F8", "text": "#1A365D"},
    {"name": "Green",  "hex": "#38A169", "bg": "#C6F6D5", "text": "#1C4532"},
    {"name": "Purple", "hex": "#805AD5", "bg": "#E9D8FD", "text": "#44337A"},
    {"name": "Orange", "hex": "#DD6B20", "bg": "#FEEBC8", "text": "#7B341E"},
    {"name": "Pink",   "hex": "#D53F8C", "bg": "#FED7E2", "text": "#702459"},
    {"name": "Teal",   "hex": "#319795", "bg": "#B2F5EA", "text": "#1D4044"},
    {"name": "Yellow", "hex": "#D69E2E", "bg": "#FEFCBF", "text": "#744210"},
]


def get_project_color(project_id: str) -> dict:
    """Deterministically assign a color to a project based on its ID."""
    if not project_id:
        return PROJECT_COLORS[0]
    try:
        index = int(project_id[-3:], 16) % len(PROJECT_COLORS)
    except (ValueError, IndexError):
        index = sum(ord(c) for c in project_id) % len(PROJECT_COLORS)
    return PROJECT_COLORS[index]


def get_all_project_colors(projects: list) -> dict:
    """Return a mapping of project_id -> color dict for a list of project dicts."""
    return {p["id"]: get_project_color(p["id"]) for p in projects if p.get("id")}
