/**
 * Діагностичний скрипт для перевірки 3D моделі та UI
 */

// Запускаємо після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    console.log('🔍 === ДІАГНОСТИКА 3D МОДЕЛІ ТА UI ===');
    
    // Перевірка model-viewer
    const modelViewer = document.getElementById('model-viewer');
    console.log('📦 Model Viewer:', modelViewer ? '✅ Знайдено' : '❌ НЕ ЗНАЙДЕНО');
    
    if (modelViewer) {
      console.log('  - Display:', window.getComputedStyle(modelViewer).display);
      console.log('  - Visibility:', window.getComputedStyle(modelViewer).visibility);
      console.log('  - Opacity:', window.getComputedStyle(modelViewer).opacity);
      console.log('  - Z-index:', window.getComputedStyle(modelViewer).zIndex);
      console.log('  - Pointer-events:', window.getComputedStyle(modelViewer).pointerEvents);
      console.log('  - Loaded:', modelViewer.loaded);
      console.log('  - Model:', modelViewer.model ? '✅' : '❌');
    }
    
    // Перевірка model-container
    const modelContainer = document.querySelector('.model-container');
    console.log('📦 Model Container:', modelContainer ? '✅ Знайдено' : '❌ НЕ ЗНАЙДЕНО');
    
    if (modelContainer) {
      console.log('  - Display:', window.getComputedStyle(modelContainer).display);
      console.log('  - Visibility:', window.getComputedStyle(modelContainer).visibility);
      console.log('  - Opacity:', window.getComputedStyle(modelContainer).opacity);
      console.log('  - Z-index:', window.getComputedStyle(modelContainer).zIndex);
    }
    
    // Перевірка input
    const messageInput = document.getElementById('message-input');
    console.log('💬 Message Input:', messageInput ? '✅ Знайдено' : '❌ НЕ ЗНАЙДЕНО');
    
    if (messageInput) {
      console.log('  - Display:', window.getComputedStyle(messageInput).display);
      console.log('  - Visibility:', window.getComputedStyle(messageInput).visibility);
      console.log('  - Pointer-events:', window.getComputedStyle(messageInput).pointerEvents);
      console.log('  - Disabled:', messageInput.disabled);
      console.log('  - ReadOnly:', messageInput.readOnly);
      
      // Тест фокусу
      try {
        messageInput.focus();
        console.log('  - Focus test: ✅ Працює');
      } catch (e) {
        console.log('  - Focus test: ❌ Помилка:', e.message);
      }
    }
    
    // Перевірка input-container
    const inputContainer = document.querySelector('.input-container');
    console.log('💬 Input Container:', inputContainer ? '✅ Знайдено' : '❌ НЕ ЗНАЙДЕНО');
    
    if (inputContainer) {
      console.log('  - Display:', window.getComputedStyle(inputContainer).display);
      console.log('  - Pointer-events:', window.getComputedStyle(inputContainer).pointerEvents);
    }
    
    // Перевірка chat-panel
    const chatPanel = document.querySelector('.minimal-chat-panel');
    console.log('💬 Chat Panel:', chatPanel ? '✅ Знайдено' : '❌ НЕ ЗНАЙДЕНО');
    
    if (chatPanel) {
      console.log('  - Display:', window.getComputedStyle(chatPanel).display);
      console.log('  - Z-index:', window.getComputedStyle(chatPanel).zIndex);
      console.log('  - Pointer-events:', window.getComputedStyle(chatPanel).pointerEvents);
    }
    
    // Перевірка managers
    if (window.atlasApp) {
      console.log('🎮 Atlas App:', '✅ Знайдено');
      console.log('  - glbLivingSystem:', window.atlasApp.managers.glbLivingSystem ? '✅' : '❌');
      console.log('  - livingBehavior:', window.atlasApp.managers.livingBehavior ? '✅' : '❌');
      console.log('  - enhancedBehavior:', window.atlasApp.managers.enhancedBehavior ? '✅' : '❌');
      console.log('  - ttsVisualization:', window.atlasApp.managers.ttsVisualization ? '✅' : '❌');
      
      if (window.atlasApp.managers.glbLivingSystem) {
        const living = window.atlasApp.managers.glbLivingSystem;
        console.log('  - Living state:', {
          isAlive: living.livingState.isAlive,
          isAwake: living.livingState.isAwake,
          isSpeaking: living.livingState.isSpeaking
        });
      }
    } else {
      console.log('🎮 Atlas App:', '❌ НЕ ЗНАЙДЕНО');
    }
    
    console.log('🔍 === КІНЕЦЬ ДІАГНОСТИКИ ===');
  }, 2000); // Чекаємо 2 секунди після завантаження
});
