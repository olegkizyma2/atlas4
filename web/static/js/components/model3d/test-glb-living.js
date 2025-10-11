/**
 * ATLAS GLB Living System - Test & Demo
 *
 * Швидке тестування та демонстрація живої поведінки шолома
 */

// Чекаємо завантаження системи
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!window.atlasApp || !window.atlasApp.managers.glbLivingSystem) {
      console.warn('⚠️ GLB Living System not initialized yet. Waiting...');
      return;
    }

    console.log('🧪 Atlas GLB Test Suite loaded. Use window.testAtlasGLB for manual testing.');

    // АВТОТЕСТИ ВИМКНЕНО - запускаються тільки вручну
    // Раніше тести виконувалися автоматично, що могло заважати роботі voice control

    // Тест можна запустити вручну:
    // window.testAtlasGLB.runAll() - всі тести
    // window.testAtlasGLB.emotions() - тільки емоції
    // window.testAtlasGLB.voices() - тільки голосові події

  }, 3000);
});

/**
 * Тест базових емоцій
 */
function testBasicEmotions() {
  const emotions = [
    { name: 'joy', intensity: 0.9, duration: 2000 },
    { name: 'curious', intensity: 0.8, duration: 1500 },
    { name: 'focused', intensity: 0.85, duration: 2000 },
    { name: 'alert', intensity: 1.0, duration: 800 },
    { name: 'excited', intensity: 0.9, duration: 1200 },
    { name: 'thinking', intensity: 0.7, duration: 2000 },
    { name: 'satisfied', intensity: 0.75, duration: 1500 }
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index >= emotions.length) {
      clearInterval(interval);
      console.log('✅ Basic emotions test completed');
      return;
    }

    const emotion = emotions[index];
    console.log(`  ➡️ Testing emotion: ${emotion.name} (intensity: ${emotion.intensity})`);
    window.atlasApp.setAtlasEmotion(emotion.name, emotion.intensity, emotion.duration);

    index++;
  }, 2500);
}

/**
 * Тест відповідей агентів
 */
function testAgentResponses() {
  const agents = ['atlas', 'tetyana', 'grisha'];

  agents.forEach((agent, index) => {
    setTimeout(() => {
      console.log(`  ➡️ Testing ${agent} speaking...`);
      window.atlasApp.atlasStartSpeaking(agent, 0.8);

      setTimeout(() => {
        window.atlasApp.atlasStopSpeaking();
        console.log(`  ✓ ${agent} finished speaking`);
      }, 3000);
    }, index * 4000);
  });

  setTimeout(() => {
    console.log('✅ Agent responses test completed');
  }, 13000);
}

/**
 * Тест голосових подій
 */
function testVoiceEvents() {
  const events = [
    { type: 'keyword-detected', data: { keyword: 'Атлас' } },
    { type: 'recording-start', data: {} },
    { type: 'recording-stop', data: {} },
    { type: 'message-sent', data: {} },
    { type: 'agent-thinking', data: { agent: 'atlas' } },
    { type: 'error', data: {} }
  ];

  events.forEach((event, index) => {
    setTimeout(() => {
      console.log(`  ➡️ Testing event: ${event.type}`);
      window.atlasApp.atlasReactToEvent(event.type, event.data);
    }, index * 2000);
  });

  setTimeout(() => {
    console.log('✅ Voice events test completed');
  }, 13000);
}

/**
 * Тест життєвого циклу
 */
function testLifeCycle() {
  console.log('  ➡️ Testing life cycle behaviors...');

  // Імітація активності користувача
  console.log('  📍 Simulating user activity...');

  // Рух мишки
  const moveEvent = new MouseEvent('mousemove', {
    clientX: window.innerWidth / 2,
    clientY: window.innerHeight / 2
  });
  document.dispatchEvent(moveEvent);

  setTimeout(() => {
    console.log('  📍 Simulating user leaving...');
    const leaveEvent = new MouseEvent('mouseleave');
    document.dispatchEvent(leaveEvent);
  }, 3000);

  setTimeout(() => {
    console.log('  📍 Simulating user returning...');
    const enterEvent = new MouseEvent('mouseenter');
    document.dispatchEvent(enterEvent);
  }, 6000);

  setTimeout(() => {
    console.log('✅ Life cycle test completed\n');
    console.log('🎉 All tests completed successfully!\n');
    showTestResults();
  }, 9000);
}

/**
 * Відображення результатів тестування
 */
function showTestResults() {
  const livingSystem = window.atlasApp.managers.glbLivingSystem;
  const state = livingSystem.livingState;

  console.log('═══════════════════════════════════════');
  console.log('📊 ATLAS GLB Living System - Test Results');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('Current State:');
  console.log('  • Is Alive:', state.isAlive ? '✅' : '❌');
  console.log('  • Is Awake:', state.isAwake ? '✅' : '❌');
  console.log('  • Current Emotion:', state.currentEmotion);
  console.log('  • Attention Level:', state.attentionLevel.toFixed(2));
  console.log('  • Energy Level:', state.energyLevel.toFixed(2));
  console.log('  • Is Speaking:', state.isSpeaking ? '🎤' : '🔇');
  console.log('  • User Present:', state.isUserPresent ? '👤' : '👻');
  console.log('');
  console.log('Memory:');
  console.log('  • Emotional Memory:', state.emotionalMemory.size, 'emotions recorded');
  console.log('  • Interaction History:', state.interactionHistory.length, 'interactions');
  console.log('');
  console.log('Configuration:');
  console.log('  • Breathing:', livingSystem.config.enableBreathing ? '✅' : '❌');
  console.log('  • Eye Tracking:', livingSystem.config.enableEyeTracking ? '✅' : '❌');
  console.log('  • Emotions:', livingSystem.config.enableEmotions ? '✅' : '❌');
  console.log('  • TTS Sync:', livingSystem.config.enableTTSSync ? '✅' : '❌');
  console.log('  • Intelligence:', livingSystem.config.enableIntelligence ? '✅' : '❌');
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('💡 Try these commands in console:');
  console.log('   atlasApp.setAtlasEmotion("joy", 0.9, 2000)');
  console.log('   atlasApp.atlasStartSpeaking("atlas", 0.8)');
  console.log('   atlasApp.atlasStopSpeaking()');
  console.log('   atlasApp.atlasReactToEvent("keyword-detected")');
  console.log('');
}

// Експорт для консолі
window.testAtlasGLB = {
  emotions: testBasicEmotions,
  agents: testAgentResponses,
  voiceEvents: testVoiceEvents,
  lifeCycle: testLifeCycle,
  results: showTestResults,

  // Запуск всіх тестів послідовно
  runAll: function() {
    console.log('🧪 Starting Complete Atlas GLB Living System Tests...\n');

    // Тест 1: Базові емоції
    console.log('📊 Test 1: Basic Emotions');
    testBasicEmotions();

    // Тест 2: Агенти
    setTimeout(() => {
      console.log('\n📊 Test 2: Agent Responses');
      testAgentResponses();
    }, 15000);

    // Тест 3: Голосові події
    setTimeout(() => {
      console.log('\n📊 Test 3: Voice Events');
      testVoiceEvents();
    }, 30000);

    // Тест 4: Цикл життя
    setTimeout(() => {
      console.log('\n📊 Test 4: Life Cycle');
      testLifeCycle();
    }, 45000);

    // Результати
    setTimeout(() => {
      showTestResults();
    }, 60000);
  }
};

console.log('🧪 Atlas GLB Test Suite loaded. Use window.testAtlasGLB.runAll() to run all tests or individual test methods.');
