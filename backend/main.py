from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import intake, approvals, contracts, completions, extensions, files, notifications, inventory, vendors, analytics, heather, employees, schedule

app = FastAPI(title="Aura Home Staging AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake.router)
app.include_router(approvals.router)
app.include_router(contracts.router)
app.include_router(completions.router)
app.include_router(extensions.router)
app.include_router(files.router)
app.include_router(notifications.router)
app.include_router(inventory.router)
app.include_router(vendors.router)
app.include_router(analytics.router)
app.include_router(heather.router)
app.include_router(employees.router)
app.include_router(schedule.router)


@app.get("/")
async def root():
    return {"status": "online", "app": "Aura Home Staging AI", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
