"""
FastAPI application with GraphQL endpoint using Strawberry
"""
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from strawberry.fastapi import GraphQLRouter
from contextlib import asynccontextmanager
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.schema import schema
from app.config import settings
from app.database import get_database, close_database
from app.auth import get_context
from app.services.panel_classifier_service import panel_classifier_service
from app.services.ml_model_service import ml_model_service
from app.services.ml_consumption_service import ml_consumption_service

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


async def _periodic_snapshot_saver():
    """Save a solar snapshot to MongoDB every 5 minutes for historical trend data."""
    while True:
        try:
            await asyncio.sleep(300)  # 5 minutes
            from app.services.solar_service import get_solar_snapshot
            from app.services.lectura_service import save_reading
            snapshot_data = await get_solar_snapshot()
            current = snapshot_data.get("current", {})
            battery = snapshot_data.get("battery", {})
            weather = snapshot_data.get("weather", {})
            save_reading({
                "production": current.get("production", 0),
                "consumption": current.get("consumption", 0),
                "batteryLevel": battery.get("chargeLevel", 0),
                "gridExport": current.get("gridExport", 0),
                "gridImport": current.get("gridImport", 0),
                "efficiency": current.get("efficiency", 0),
                "weather": {
                    "temperature": weather.get("temperature"),
                    "cloudCover": weather.get("cloudCover"),
                    "solarRadiation": weather.get("solarRadiation"),
                },
            })
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"⚠️  Background snapshot error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    """
    # Startup
    print("🚀 Starting Digital Twin GraphQL API...")
    get_database()  # Initialize database connection

    # Load ML model for panel classification
    try:
        panel_classifier_service.load_model()
    except Exception as e:
        print(f"⚠️  Warning: Could not load panel classifier model: {e}")
        print("   Panel classification endpoint will not be available.")

    # Load ML model for solar production prediction (La Habana, capacity factor)
    try:
        ml_model_service.load_model(model_name="havana_v1")
    except Exception as e:
        print(f"⚠️  Warning: Could not load solar production prediction model: {e}")
        print("   Solar production prediction endpoint will not be available.")
        print("   Please run the training script: backend/notebooks/train_solar_havana.py")

    # Load ML model for consumption prediction
    # try:
    #     ml_consumption_service.load_model()
    # except Exception as e:
    #     print(f"⚠️  Warning: Could not load consumption prediction model: {e}")
    #     print("   Consumption prediction endpoint will not be available.")
    #     print("   Please run the training notebook: backend/notebooks/06_prediccion_consumo.ipynb")

    # Start background task for historical data collection
    task = asyncio.create_task(_periodic_snapshot_saver())

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    # Shutdown
    print("👋 Shutting down Digital Twin GraphQL API...")
    close_database()


# Create FastAPI application
app = FastAPI(
    title="Digital Twin GraphQL API",
    description="GraphQL API for photovoltaic microgrid digital twin system",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": "Demasiadas solicitudes. Por favor espera un momento antes de continuar."},
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create GraphQL router
graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,
    graphiql=True,  # Enable GraphiQL interface in development
)

# Mount GraphQL endpoint
app.include_router(graphql_app, prefix="/graphql")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Digital Twin GraphQL API",
        "version": "1.0.0",
        "graphql_endpoint": "/graphql",
        "graphiql_interface": "/graphql (in browser)",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        db = get_database()
        # Test database connection
        db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
        }


@app.post("/api/classify-panel")
async def classify_panel(file: UploadFile = File(...)):
    """
    Classify a solar panel image as clean or dusty.

    Args:
        file: Image file to classify (JPEG, PNG, etc.)

    Returns:
        JSON with:
        - clasificacion: "limpio" or "sucio"
        - porcentaje_limpio: Clean probability (0-100)
        - porcentaje_sucio: Dusty probability (0-100)

    Example:
        curl -X POST "http://localhost:8000/api/classify-panel" \
             -F "file=@panel_image.jpg"
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail="File must be an image (JPEG, PNG, etc.)"
        )

    try:
        # Read image bytes
        image_bytes = await file.read()

        # Classify using the service
        result = panel_classifier_service.classify_panel(image_bytes)

        return result

    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing image: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
