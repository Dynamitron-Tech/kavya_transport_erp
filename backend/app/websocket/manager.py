# WebSocket Manager for Real-time Tracking
# Transport ERP

from typing import Dict, List, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
import json
import logging

from app.core.security import decode_token

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    WebSocket connection manager for real-time features:
    - Live vehicle tracking
    - Real-time alerts
    - Trip status updates
    - Dashboard real-time updates
    """
    
    def __init__(self):
        # Active connections grouped by channel
        self.active_connections: Dict[str, List[WebSocket]] = {}
        
        # User-specific connections (for notifications)
        self.user_connections: Dict[int, List[WebSocket]] = {}
        
        # Vehicle tracking subscriptions
        self.vehicle_subscribers: Dict[int, Set[WebSocket]] = {}
        
        # Trip tracking subscriptions
        self.trip_subscribers: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, channel: str = "general"):
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
        
        logger.info(f"WebSocket connected to channel: {channel}")
    
    async def connect_user(self, websocket: WebSocket, user_id: int):
        """Connect a specific user for notifications."""
        await websocket.accept()
        
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, channel: str = "general"):
        """Remove a WebSocket connection."""
        if channel in self.active_connections:
            self.active_connections[channel] = [
                ws for ws in self.active_connections[channel] if ws != websocket
            ]
        
        # Clean up vehicle subscriptions
        for vehicle_id in list(self.vehicle_subscribers.keys()):
            self.vehicle_subscribers[vehicle_id].discard(websocket)
            if not self.vehicle_subscribers[vehicle_id]:
                del self.vehicle_subscribers[vehicle_id]
        
        # Clean up trip subscriptions
        for trip_id in list(self.trip_subscribers.keys()):
            self.trip_subscribers[trip_id].discard(websocket)
            if not self.trip_subscribers[trip_id]:
                del self.trip_subscribers[trip_id]
        
        # Clean up user connections
        for user_id in list(self.user_connections.keys()):
            self.user_connections[user_id] = [
                ws for ws in self.user_connections[user_id] if ws != websocket
            ]
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
    
    def subscribe_vehicle(self, websocket: WebSocket, vehicle_id: int):
        """Subscribe to a vehicle's tracking updates."""
        if vehicle_id not in self.vehicle_subscribers:
            self.vehicle_subscribers[vehicle_id] = set()
        self.vehicle_subscribers[vehicle_id].add(websocket)
    
    def subscribe_trip(self, websocket: WebSocket, trip_id: int):
        """Subscribe to a trip's updates."""
        if trip_id not in self.trip_subscribers:
            self.trip_subscribers[trip_id] = set()
        self.trip_subscribers[trip_id].add(websocket)
    
    async def broadcast(self, message: dict, channel: str = "general"):
        """Broadcast message to all connections in a channel."""
        if channel in self.active_connections:
            disconnected = []
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
            
            for ws in disconnected:
                self.disconnect(ws, channel)
    
    async def send_to_user(self, user_id: int, message: dict):
        """Send message to a specific user."""
        if user_id in self.user_connections:
            disconnected = []
            for ws in self.user_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.append(ws)
            
            for ws in disconnected:
                self.disconnect(ws)
    
    async def send_vehicle_update(self, vehicle_id: int, data: dict):
        """Send tracking update to all subscribers of a vehicle."""
        message = {
            "type": "vehicle_tracking",
            "vehicle_id": vehicle_id,
            "data": data
        }
        
        if vehicle_id in self.vehicle_subscribers:
            disconnected = []
            for ws in self.vehicle_subscribers[vehicle_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.append(ws)
            
            for ws in disconnected:
                self.vehicle_subscribers[vehicle_id].discard(ws)
    
    async def send_trip_update(self, trip_id: int, data: dict):
        """Send trip status update to subscribers."""
        message = {
            "type": "trip_update",
            "trip_id": trip_id,
            "data": data
        }
        
        if trip_id in self.trip_subscribers:
            disconnected = []
            for ws in self.trip_subscribers[trip_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.append(ws)
            
            for ws in disconnected:
                self.trip_subscribers[trip_id].discard(ws)
    
    async def send_alert(self, alert: dict, tenant_id: Optional[int] = None):
        """Broadcast alert to tracking channel."""
        message = {
            "type": "alert",
            "data": alert
        }
        await self.broadcast(message, channel="tracking")
    
    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "total_channels": len(self.active_connections),
            "total_connections": sum(
                len(conns) for conns in self.active_connections.values()
            ),
            "user_connections": len(self.user_connections),
            "vehicle_subscriptions": len(self.vehicle_subscribers),
            "trip_subscriptions": len(self.trip_subscribers),
        }


# Global connection manager instance
ws_manager = ConnectionManager()


async def authenticate_websocket(websocket: WebSocket) -> Optional[dict]:
    """
    Authenticate WebSocket connection using JWT token.
    Token can be passed as query parameter or in first message.
    """
    token = websocket.query_params.get("token")
    
    if token:
        payload = decode_token(token)
        if payload:
            return payload
    
    return None
