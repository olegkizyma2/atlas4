#!/usr/bin/env python3
"""
ATLAS Recovery Bridge
WebSocket сервіс для відновлення системи на порті 5102
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] Recovery Bridge: %(message)s'
)
logger = logging.getLogger('atlas.recovery')

class RecoveryBridge:
    def __init__(self, port=5102):
        self.port = port
        self.clients = set()
        
    async def register_client(self, websocket):
        """Реєстрація нового клієнта"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")
        
    async def unregister_client(self, websocket):
        """Відключення клієнта"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")
        
    async def handle_message(self, websocket, message):
        """Обробка повідомлень від клієнтів"""
        try:
            data = json.loads(message)
            logger.info(f"Received message: {data}")
            
            # Відповідь клієнту
            response = {
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "received": data
            }
            
            await websocket.send(json.dumps(response))
            
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
            await websocket.send(json.dumps({
                "status": "error", 
                "message": "Invalid JSON"
            }))
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            
    async def handler(self, websocket, path):
        """Основний обробник WebSocket з'єднань"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            await self.unregister_client(websocket)
            
    async def broadcast(self, message):
        """Розсилка повідомлення всім клієнтам"""
        if self.clients:
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )
            
    async def start_server(self):
        """Запуск WebSocket сервера"""
        logger.info(f"Starting Recovery Bridge on port {self.port}")
        
        server = await websockets.serve(
            self.handler, 
            "localhost", 
            self.port
        )
        
        logger.info(f"Recovery Bridge listening on ws://localhost:{self.port}")
        
        # Періодична перевірка системи
        asyncio.create_task(self.health_check())
        
        await server.wait_closed()
        
    async def health_check(self):
        """Періодична перевірка стану системи"""
        while True:
            try:
                # Здійснюємо перевірку кожні 30 секунд
                await asyncio.sleep(30)
                
                health_message = {
                    "type": "health_check",
                    "timestamp": datetime.now().isoformat(),
                    "clients_count": len(self.clients),
                    "status": "active"
                }
                
                await self.broadcast(json.dumps(health_message))
                logger.debug(f"Health check completed. Active clients: {len(self.clients)}")
                
            except Exception as e:
                logger.error(f"Health check error: {e}")

async def main():
    """Головна функція"""
    recovery_bridge = RecoveryBridge()
    
    try:
        await recovery_bridge.start_server()
    except KeyboardInterrupt:
        logger.info("Recovery Bridge shutting down...")
    except Exception as e:
        logger.error(f"Recovery Bridge error: {e}")

if __name__ == "__main__":
    asyncio.run(main())