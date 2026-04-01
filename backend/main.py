from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import intake, approvals, contracts, completions

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


@app.get("/")
async def root():
    return {"status": "online", "app": "Aura Home Staging AI", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
