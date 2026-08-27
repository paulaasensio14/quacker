"use strict";

(() => {
  const root = document.getElementById("quackerRun");
  if (!root) return;

  const I18n = window.I18n;
  if (!I18n) return;

  const stage = document.getElementById("quackerRunStage");
  const ground = stage?.querySelector(".run-ground");
  const duck = document.getElementById("quackerRunDuck");
  const duckSprite =
    document.getElementById("quackerRunDuckSprite");
  const score = document.getElementById("quackerRunScore");
  const best = document.getElementById("quackerRunBest");
  const startButton = document.getElementById("quackerRunStart");
  const crouchButton =
    document.getElementById("quackerRunCrouch");
  const status = document.getElementById("quackerRunStatus");

  if (
    !stage ||
    !ground ||
    !duck ||
    !duckSprite ||
    !score ||
    !best ||
    !startButton ||
    !crouchButton ||
    !status
  ) {
    return;
  }

  I18n.init();

  function applySavedTheme() {
    let savedTheme = "light";

    try {
      savedTheme =
        localStorage.getItem("quacker_theme") === "dark"
          ? "dark"
          : "light";
    } catch {
      savedTheme = "light";
    }

    document.body.classList.toggle(
      "dark-theme",
      savedTheme === "dark"
    );
  }

  applySavedTheme();

  const RUN_FRAMES = [
    "/assets/img/quacker-run/duck-run-1.png",
    "/assets/img/quacker-run/duck-run-2.png",
    "/assets/img/quacker-run/duck-run-3.png",
    "/assets/img/quacker-run/duck-run-4.png"
  ];

  const JUMP_FRAME =
    "/assets/img/quacker-run/duck-jump.png";

  const CROUCH_FRAME =
    "/assets/img/quacker-run/duck-crouch.png";

  const IDLE_FRAME =
    "/assets/img/quacker-run/duck-idle.png";

  const HIT_FRAME =
    "/assets/img/quacker-run/duck-hit.png";

  const GAME_OVER_FRAME =
    "/assets/img/quacker-run/duck-game-over.png";

  const HIT_DURATION_MS = 280;

  const DUCK_FRAME_INTERVAL = 1 / 9;

  const GRAVITY = 2200;
  const JUMP_VELOCITY = -760;
  const OBSTACLE_SPEED = 360;
  const MAX_OBSTACLE_SPEED = 520;
  const MIN_SPAWN_INTERVAL = 0.78;
  const MAX_SPAWN_INTERVAL = 1.9;
  const OBSTACLE_WIDTH = 30;
  const GROUND_OBSTACLE = "ground";
  const AIR_OBSTACLE = "air";
  const AIR_OBSTACLE_MIN_SCORE = 80;
  const AIR_OBSTACLE_CHANCE = 0.35;

  const GROUND_OBSTACLE_SPRITES = [
    "/assets/img/quacker-run/obstacles/ground/cactus.png",
    "/assets/img/quacker-run/obstacles/ground/crate.png",
    "/assets/img/quacker-run/obstacles/ground/log.png",
    "/assets/img/quacker-run/obstacles/ground/rock-small.png",
    "/assets/img/quacker-run/obstacles/ground/rock-tall.png",
    "/assets/img/quacker-run/obstacles/ground/stump.png"
  ];

  const AIR_ENEMY_SPRITES = [
    [
      "/assets/img/quacker-run/enemies/air/nightwing/nightwing-1.png",
      "/assets/img/quacker-run/enemies/air/nightwing/nightwing-2.png"
    ],
    [
      "/assets/img/quacker-run/enemies/air/crow/crow-1.png",
      "/assets/img/quacker-run/enemies/air/crow/crow-2.png"
    ],
    [
      "/assets/img/quacker-run/enemies/air/bat/bat-1.png",
      "/assets/img/quacker-run/enemies/air/bat/bat-2.png"
    ],
    [
      "/assets/img/quacker-run/enemies/air/seagull/seagull-1.png",
      "/assets/img/quacker-run/enemies/air/seagull/seagull-2.png"
    ]
  ];

  const AIR_ENEMY_FRAME_INTERVAL = 1 / 6;

  const RUN_DUST_FRAMES = [
    "/assets/img/quacker-run/effects/dust-run/dust-run-1.png",
    "/assets/img/quacker-run/effects/dust-run/dust-run-2.png",
    "/assets/img/quacker-run/effects/dust-run/dust-run-3.png"
  ];

  const JUMP_DUST_FRAMES = [
    "/assets/img/quacker-run/effects/jump-dust/jump-dust-1.png",
    "/assets/img/quacker-run/effects/jump-dust/jump-dust-2.png",
    "/assets/img/quacker-run/effects/jump-dust/jump-dust-3.png"
  ];

  const RUN_DUST_FRAME_INTERVAL = 1 / 10;
  const JUMP_DUST_FRAME_INTERVAL = 1 / 14;

  const STAR_HIT_FRAMES = [
    "/assets/img/quacker-run/effects/star-hit/star-hit-1.png",
    "/assets/img/quacker-run/effects/star-hit/star-hit-2.png"
  ];

  const STAR_HIT_FRAME_MS = 90;

  const PARALLAX_LAYERS = [
    {
      className: "is-mountains",
      image: "/assets/img/quacker-run/parallax/mountains.png",
      speed: 18
    },
    {
      className: "is-hills",
      image: "/assets/img/quacker-run/parallax/hills.png",
      speed: 34
    },
    {
      className: "is-trees",
      image: "/assets/img/quacker-run/parallax/trees.png",
      speed: 58
    }
  ];

  const GROUND_SCROLL_SPEED = 240;

  const BEST_SCORE_KEY = "quackerRunBestScore";

  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  let prefersReducedMotion = reducedMotionQuery.matches;

  let isRunning = false;
  let isPaused = false;
  let isCrouching = false;
  let currentScore = 0;
  let bestScore = 0;
  let duckY = 0;
  let duckVelocity = 0;
  let duckFrameIndex = 0;
  let duckFrameElapsed = 0;
  let lastFrameTime = 0;
  let animationFrameId = null;
  let gameOverTimeoutId = null;
  let nextObstacleIn = 0;
  let obstacles = [];

  let runDustFrameIndex = 0;
  let runDustFrameElapsed = 0;
  let jumpDustFrameIndex = 0;
  let jumpDustFrameElapsed = 0;
  let jumpDustActive = false;
  let starHitTimeoutIds = [];

  const runDustSprite = document.createElement("img");
  runDustSprite.className = "run-dust-sprite";
  runDustSprite.src = RUN_DUST_FRAMES[0];
  runDustSprite.alt = "";
  runDustSprite.draggable = false;
  runDustSprite.hidden = true;

  const jumpDustSprite = document.createElement("img");
  jumpDustSprite.className = "jump-dust-sprite";
  jumpDustSprite.src = JUMP_DUST_FRAMES[0];
  jumpDustSprite.alt = "";
  jumpDustSprite.draggable = false;
  jumpDustSprite.hidden = true;

  const starHitSprite = document.createElement("img");
  starHitSprite.className = "star-hit-sprite";
  starHitSprite.src = STAR_HIT_FRAMES[0];
  starHitSprite.alt = "";
  starHitSprite.draggable = false;
  starHitSprite.hidden = true;

  stage.insertBefore(runDustSprite, duck);
  stage.insertBefore(jumpDustSprite, duck);
  stage.insertBefore(starHitSprite, duck);

  const parallaxElements = PARALLAX_LAYERS.map((layer) => {
    const element = document.createElement("div");

    element.className =
      `run-parallax-layer ${layer.className}`;
    element.style.backgroundImage =
      `url("${layer.image}")`;
    element.setAttribute("aria-hidden", "true");

    stage.insertBefore(element, stage.firstChild);

    return element;
  });

  const parallaxOffsets =
    PARALLAX_LAYERS.map(() => 0);

  let groundOffset = 0;

  function loadBestScore() {
    try {
      const stored = Number(localStorage.getItem(BEST_SCORE_KEY));

      if (Number.isFinite(stored) && stored > 0) {
        bestScore = Math.floor(stored);
      }
    } catch {
      bestScore = 0;
    }

    best.textContent = String(bestScore);
  }

  function saveBestScore() {
    try {
      localStorage.setItem(
        BEST_SCORE_KEY,
        String(bestScore)
      );
    } catch {
      // El juego sigue funcionando aunque el almacenamiento esté bloqueado.
    }
  }

  function updateScore(deltaSeconds) {
    currentScore += deltaSeconds * 10;
    score.textContent = String(Math.floor(currentScore));
  }

  function updateBestScore() {
    const finalScore = Math.floor(currentScore);

    if (finalScore <= bestScore) return;

    bestScore = finalScore;
    best.textContent = String(bestScore);
    saveBestScore();
  }

  function renderDuck() {
    duck.style.transform = `translate3d(0, ${duckY}px, 0)`;
  }

  function resetDustEffects() {
    runDustFrameIndex = 0;
    runDustFrameElapsed = 0;
    jumpDustFrameIndex = 0;
    jumpDustFrameElapsed = 0;
    jumpDustActive = false;

    runDustSprite.src = RUN_DUST_FRAMES[0];
    jumpDustSprite.src = JUMP_DUST_FRAMES[0];

    runDustSprite.hidden = true;
    jumpDustSprite.hidden = true;
  }

  function startJumpDust() {
    runDustSprite.hidden = true;

    if (prefersReducedMotion) {
      jumpDustActive = false;
      jumpDustSprite.hidden = true;
      return;
    }

    jumpDustFrameIndex = 0;
    jumpDustFrameElapsed = 0;
    jumpDustActive = true;
    jumpDustSprite.src = JUMP_DUST_FRAMES[0];
    jumpDustSprite.hidden = false;
  }

  function updateRunDust(deltaSeconds) {
    if (
      prefersReducedMotion ||
      !isRunning ||
      isPaused ||
      isCrouching ||
      duckY < 0
    ) {
      runDustSprite.hidden = true;
      return;
    }

    runDustSprite.hidden = false;
    runDustFrameElapsed += deltaSeconds;

    while (
      runDustFrameElapsed >= RUN_DUST_FRAME_INTERVAL
    ) {
      runDustFrameElapsed -= RUN_DUST_FRAME_INTERVAL;
      runDustFrameIndex =
        (runDustFrameIndex + 1) % RUN_DUST_FRAMES.length;
    }

    runDustSprite.src =
      RUN_DUST_FRAMES[runDustFrameIndex];
  }

  function updateJumpDust(deltaSeconds) {
    if (!jumpDustActive) return;

    jumpDustFrameElapsed += deltaSeconds;

    while (
      jumpDustFrameElapsed >= JUMP_DUST_FRAME_INTERVAL
    ) {
      jumpDustFrameElapsed -= JUMP_DUST_FRAME_INTERVAL;
      jumpDustFrameIndex += 1;

      if (jumpDustFrameIndex >= JUMP_DUST_FRAMES.length) {
        jumpDustActive = false;
        jumpDustSprite.hidden = true;
        return;
      }

      jumpDustSprite.src =
        JUMP_DUST_FRAMES[jumpDustFrameIndex];
    }
  }

  function clearStarHit() {
    starHitTimeoutIds.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    starHitTimeoutIds = [];
    starHitSprite.hidden = true;
    starHitSprite.src = STAR_HIT_FRAMES[0];
  }

  function startStarHit() {
    clearStarHit();

    if (prefersReducedMotion) return;

    starHitSprite.src = STAR_HIT_FRAMES[0];
    starHitSprite.hidden = false;

    starHitTimeoutIds.push(
      window.setTimeout(() => {
        starHitSprite.src = STAR_HIT_FRAMES[1];
      }, STAR_HIT_FRAME_MS)
    );

    starHitTimeoutIds.push(
      window.setTimeout(() => {
        starHitSprite.hidden = true;
        starHitTimeoutIds = [];
      }, STAR_HIT_FRAME_MS * 2)
    );
  }

  function resetDuck() {
    duckY = 0;
    duckVelocity = 0;
    duckFrameIndex = 0;
    duckFrameElapsed = 0;
    isCrouching = false;
    duck.classList.remove("is-crouching");
    duckSprite.src = RUN_FRAMES[0];
    resetDustEffects();
    clearStarHit();
    renderDuck();
  }

  function setCrouching(nextValue) {
    const canCrouch =
      Boolean(nextValue) &&
      isRunning &&
      !isPaused &&
      duckY >= 0;

    isCrouching = canCrouch;

    duck.classList.toggle(
      "is-crouching",
      isCrouching
    );

    if (isCrouching) {
      duckSprite.src = CROUCH_FRAME;
    }
  }

  function jumpDuck() {
    if (!isRunning || isPaused) return;

    // Solo permite saltar cuando el pato está en el suelo.
    if (duckY < 0) return;

    setCrouching(false);
    startJumpDust();
    duckVelocity = JUMP_VELOCITY;
  }

  function updateDuck(deltaSeconds) {
    duckVelocity += GRAVITY * deltaSeconds;
    duckY += duckVelocity * deltaSeconds;

    if (duckY >= 0) {
      duckY = 0;
      duckVelocity = 0;
    }

    renderDuck();
  }

  function updateDuckSprite(deltaSeconds) {
    if (duckY < 0) {
      duckSprite.src = JUMP_FRAME;
      return;
    }

    if (isCrouching) {
      duckSprite.src = CROUCH_FRAME;
      return;
    }

    if (prefersReducedMotion) {
      duckFrameIndex = 0;
      duckFrameElapsed = 0;
      duckSprite.src = RUN_FRAMES[0];
      return;
    }

    duckFrameElapsed += deltaSeconds;

    while (duckFrameElapsed >= DUCK_FRAME_INTERVAL) {
      duckFrameElapsed -= DUCK_FRAME_INTERVAL;
      duckFrameIndex =
        (duckFrameIndex + 1) % RUN_FRAMES.length;
    }

    duckSprite.src = RUN_FRAMES[duckFrameIndex];
  }

  function updateParallax(deltaSeconds) {
    if (prefersReducedMotion) return;

    const speedScale =
      getDifficulty().obstacleSpeed / OBSTACLE_SPEED;

    PARALLAX_LAYERS.forEach((layer, index) => {
      parallaxOffsets[index] +=
        layer.speed * speedScale * deltaSeconds;

      parallaxElements[index].style.backgroundPositionX =
        `${-parallaxOffsets[index]}px`;
    });

    groundOffset +=
      GROUND_SCROLL_SPEED * speedScale * deltaSeconds;

    ground.style.backgroundPositionX =
      `${-groundOffset}px`;
  }

  function getDifficulty() {
    const obstacleSpeed = Math.min(
      MAX_OBSTACLE_SPEED,
      OBSTACLE_SPEED + currentScore * 1.6
    );

    const spawnMin = Math.max(
      MIN_SPAWN_INTERVAL,
      1.15 - currentScore * 0.003
    );

    const spawnMax = Math.max(
      spawnMin + 0.35,
      MAX_SPAWN_INTERVAL - currentScore * 0.004
    );

    return {
      obstacleSpeed,
      spawnMin,
      spawnMax
    };
  }

  function getObstacleType() {
    if (currentScore < AIR_OBSTACLE_MIN_SCORE) {
      return GROUND_OBSTACLE;
    }

    return Math.random() < AIR_OBSTACLE_CHANCE
      ? AIR_OBSTACLE
      : GROUND_OBSTACLE;
  }

  function createObstacle() {
    const element = document.createElement("div");
    element.className = "run-obstacle";
    element.setAttribute("aria-hidden", "true");

    const type = getObstacleType();
    let sprite = null;
    let frames = null;

    if (type === AIR_OBSTACLE) {
      element.classList.add("is-airborne");

      const enemyIndex = Math.floor(
        Math.random() * AIR_ENEMY_SPRITES.length
      );

      frames = AIR_ENEMY_SPRITES[enemyIndex];
      sprite = document.createElement("img");
      sprite.className = "run-air-enemy-sprite";
      sprite.src = frames[0];
      sprite.alt = "";
      sprite.draggable = false;

      element.appendChild(sprite);
    } else {
      sprite = document.createElement("img");

      const spriteIndex = Math.floor(
        Math.random() * GROUND_OBSTACLE_SPRITES.length
      );

      sprite.className = "run-obstacle-sprite";
      sprite.src = GROUND_OBSTACLE_SPRITES[spriteIndex];
      sprite.alt = "";
      sprite.draggable = false;

      element.appendChild(sprite);
    }

    const obstacle = {
      element,
      type,
      sprite,
      frames,
      frameIndex: 0,
      frameElapsed: 0,
      x: stage.clientWidth + OBSTACLE_WIDTH,
      width: OBSTACLE_WIDTH
    };

    element.style.transform =
      `translate3d(${obstacle.x}px, 0, 0)`;

    stage.appendChild(element);
    obstacles.push(obstacle);

    return obstacle;
  }

  function resetObstacles() {
    obstacles.forEach((obstacle) => {
      obstacle.element.remove();
    });

    obstacles = [];
    nextObstacleIn = 0.9;
  }

  function updateAirEnemySprite(obstacle, deltaSeconds) {
    if (
      obstacle.type !== AIR_OBSTACLE ||
      !obstacle.sprite ||
      !obstacle.frames
    ) {
      return;
    }

    if (prefersReducedMotion) {
      obstacle.frameIndex = 0;
      obstacle.frameElapsed = 0;
      obstacle.sprite.src = obstacle.frames[0];
      return;
    }

    obstacle.frameElapsed += deltaSeconds;

    while (
      obstacle.frameElapsed >= AIR_ENEMY_FRAME_INTERVAL
    ) {
      obstacle.frameElapsed -= AIR_ENEMY_FRAME_INTERVAL;
      obstacle.frameIndex =
        (obstacle.frameIndex + 1) % obstacle.frames.length;
    }

    obstacle.sprite.src =
      obstacle.frames[obstacle.frameIndex];
  }

  function hasCollision(obstacle) {
    const duckRect = duck.getBoundingClientRect();
    const obstacleRect =
      obstacle.element.getBoundingClientRect();

    return !(
      duckRect.right <= obstacleRect.left ||
      duckRect.left >= obstacleRect.right ||
      duckRect.bottom <= obstacleRect.top ||
      duckRect.top >= obstacleRect.bottom
    );
  }

  function showGameOverSprite() {
    duckSprite.src = GAME_OVER_FRAME;
    gameOverTimeoutId = null;
  }

  function endGame() {
    setCrouching(false);
    isRunning = false;
    isPaused = false;
    updateBestScore();
    resetDustEffects();
    startStarHit();

    duckSprite.src = HIT_FRAME;

    if (prefersReducedMotion) {
      showGameOverSprite();
    } else {
      gameOverTimeoutId = window.setTimeout(
        showGameOverSprite,
        HIT_DURATION_MS
      );
    }

    root.classList.remove("is-running");
    root.classList.remove("is-paused");
    root.classList.add("is-game-over");

    startButton.dataset.i18n = "quacker_run_play_again";
    startButton.textContent =
      I18n.t("quacker_run_play_again");

    status.dataset.i18n = "quacker_run_game_over";
    status.textContent =
      I18n.t("quacker_run_game_over");
  }

  function updateObstacles(deltaSeconds) {
    const difficulty = getDifficulty();

    nextObstacleIn -= deltaSeconds;

    if (nextObstacleIn <= 0) {
      createObstacle();

      nextObstacleIn = difficulty.spawnMin +
        Math.random() *
          (difficulty.spawnMax - difficulty.spawnMin);
    }

    for (let index = obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = obstacles[index];

      obstacle.x -=
        difficulty.obstacleSpeed * deltaSeconds;

      obstacle.element.style.transform =
        `translate3d(${obstacle.x}px, 0, 0)`;

      updateAirEnemySprite(obstacle, deltaSeconds);

      if (hasCollision(obstacle)) {
        endGame();
        return;
      }

      if (obstacle.x < -obstacle.width) {
        obstacle.element.remove();
        obstacles.splice(index, 1);
      }
    }
  }

  function pauseGame() {
    if (!isRunning || isPaused) return;

    setCrouching(false);
    isPaused = true;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    root.classList.add("is-paused");
    status.dataset.i18n = "quacker_run_paused";
    status.textContent =
      I18n.t("quacker_run_paused");
  }

  function resumeGame() {
    if (!isRunning || !isPaused) return;

    isPaused = false;
    root.classList.remove("is-paused");

    lastFrameTime = 0;
    status.dataset.i18n = "quacker_run_running";
    status.textContent =
      I18n.t("quacker_run_running");

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    if (!isRunning || isPaused) return;

    if (!lastFrameTime) {
      lastFrameTime = timestamp;
    }

    const deltaSeconds = Math.min(
      (timestamp - lastFrameTime) / 1000,
      0.05
    );

    lastFrameTime = timestamp;

    updateDuck(deltaSeconds);
    updateDuckSprite(deltaSeconds);
    updateRunDust(deltaSeconds);
    updateJumpDust(deltaSeconds);
    updateParallax(deltaSeconds);
    updateObstacles(deltaSeconds);

    if (!isRunning) {
      animationFrameId = null;
      return;
    }

    updateScore(deltaSeconds);

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function startGame() {
    if (gameOverTimeoutId !== null) {
      window.clearTimeout(gameOverTimeoutId);
      gameOverTimeoutId = null;
    }

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    currentScore = 0;
    score.textContent = "0";
    root.classList.remove("is-game-over");
    root.classList.add("is-running");
    startButton.dataset.i18n = "quacker_run_restart";
    startButton.textContent =
      I18n.t("quacker_run_restart");

    status.dataset.i18n = "quacker_run_running";
    status.textContent =
      I18n.t("quacker_run_running");

    isRunning = true;
    isPaused = false;
    root.classList.remove("is-paused");
    lastFrameTime = 0;

    resetDuck();
    resetObstacles();

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function handleJumpInput() {
    if (!isRunning) {
      startGame();
    }

    jumpDuck();
  }

  loadBestScore();

  reducedMotionQuery.addEventListener?.("change", (event) => {
    prefersReducedMotion = event.matches;
    root.dataset.reducedMotion =
      prefersReducedMotion ? "true" : "false";
  });

  root.dataset.reducedMotion =
    prefersReducedMotion ? "true" : "false";

  startButton.addEventListener("click", startGame);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCrouching(true);
      return;
    }

    if (
      event.code !== "Space" &&
      event.key !== "ArrowUp"
    ) {
      return;
    }

    if (
      event.code === "Space" &&
      event.target === startButton
    ) {
      return;
    }

    event.preventDefault();
    handleJumpInput();
  });

  document.addEventListener("keyup", (event) => {
    if (event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    setCrouching(false);
  });

  crouchButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    if (event.pointerId !== undefined) {
      crouchButton.setPointerCapture?.(event.pointerId);
    }

    setCrouching(true);
  });

  crouchButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    setCrouching(false);
  });

  crouchButton.addEventListener("pointercancel", () => {
    setCrouching(false);
  });

  crouchButton.addEventListener("lostpointercapture", () => {
    setCrouching(false);
  });

  stage.addEventListener("pointerdown", () => {
    handleJumpInput();
  });

  document.addEventListener("quacker:lang-change", () => {
    I18n.applyTranslations(root);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseGame();
      return;
    }

    resumeGame();
  });
})();
