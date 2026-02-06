// ====== CORE STATE ======
let stats = {
    wildness: 0,
    loyalty: 0,
    survival: 0,
    hunger: 5,     // 0 = starving, 10 = full
    fatigue: 0,    // 0 = fresh, 10 = exhausted
    cold: 0,       // 0 = warm, 10 = freezing
    morale: 5,     // 0 = broken, 10 = inspired
    respect: 0     // pack respect
};
const MAX_STAT = 20;
const MAX_SIMPLE = 10;

let currentTheme = "light";
let inBattle = false;
let buckHP = 100;
let enemyHP = 100;
let currentEnemyConfig = null;
let currentSceneId = null;
let pathLog = [];
let chapterScores = {};
let ambientOn = false;

// ====== AUDIO ======
const howlSound = document.getElementById("howl-sound");
const ambientSound = document.getElementById("ambient-sound");

function playHowl() {
    howlSound.currentTime = 0;
    howlSound.play();
}

function toggleAmbient() {
    ambientOn = !ambientOn;
    if (ambientOn) {
        ambientSound.volume = 0.4;
        ambientSound.play();
    } else {
        ambientSound.pause();
    }
}

// ====== THEME TOGGLE ======
const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", currentTheme);
    themeToggle.textContent = currentTheme === "light" ? "🌙" : "🌞";
    if (currentSceneId !== null) {
        const scene = scenes.find(s => s.id === currentSceneId);
        if (scene) updateBackgroundForScene(scene);
    }
});

document.getElementById("sound-toggle").addEventListener("click", () => {
    toggleAmbient();
    document.getElementById("sound-toggle").textContent = ambientOn ? "🔊" : "🔈";
});

// ====== SAVE / LOAD ======
document.getElementById("save-btn").addEventListener("click", () => {
    const saveData = {
        stats,
        currentSceneId,
        pathLog,
        chapterScores,
        theme: currentTheme
    };
    localStorage.setItem("buckSave", JSON.stringify(saveData));
    alert("Game saved.");
});

document.getElementById("load-btn").addEventListener("click", () => {
    const raw = localStorage.getItem("buckSave");
    if (!raw) {
        alert("No save found.");
        return;
    }
    const saveData = JSON.parse(raw);
    stats = saveData.stats;
    currentSceneId = saveData.currentSceneId;
    pathLog = saveData.pathLog || [];
    chapterScores = saveData.chapterScores || {};
    currentTheme = saveData.theme || "light";
    document.body.setAttribute("data-theme", currentTheme);
    themeToggle.textContent = currentTheme === "light" ? "🌙" : "🌞";
    updateStatBars();
    showScene(currentSceneId);
});

// ====== BACKGROUND / IMAGES ======
function updateBackgroundForScene(scene) {
    const background = document.getElementById("background");
    const spitz = document.getElementById("spitz");
    const human = document.getElementById("human-enemy");
    const buck = document.getElementById("buck");

    const isBattle = scene.type === "battle";
    const isNight = isBattle ? true : (scene.id % 2 === 0);

    background.style.opacity = 0;

    setTimeout(() => {
        background.src = isNight ? "winternight.png" : "winterday.png";
        background.style.opacity = 1;
    }, 250);

    spitz.style.display = (isBattle && scene.enemy === "spitz") ? "block" : "none";
    human.style.display = (isBattle && scene.enemy === "humans") ? "block" : "none";
    buck.style.left = isBattle ? "40px" : "20px";

    if (!isBattle) {
        if (isNight) {
            stats.cold = Math.min(MAX_SIMPLE, stats.cold + 1);
            stats.fatigue = Math.min(MAX_SIMPLE, stats.fatigue + 1);
        } else {
            stats.morale = Math.min(MAX_SIMPLE, stats.morale + 1);
        }
        updateStatBars();
    }
}

// ====== STAT BARS ======
function updateStatBars(oldStats = null) {
    const ids = {
        wildness: "wildness-bar",
        loyalty: "loyalty-bar",
        survival: "survival-bar",
        hunger: "hunger-bar",
        fatigue: "fatigue-bar",
        cold: "cold-bar",
        morale: "morale-bar",
        respect: "respect-bar"
    };

    for (const key in ids) {
        const bar = document.getElementById(ids[key]);
        if (!bar) continue;
        const max = (key === "wildness" || key === "loyalty" || key === "survival") ? MAX_STAT : MAX_SIMPLE;
        const clamp = v => Math.max(0, Math.min(max, v));
        const value = clamp(stats[key]);
        const oldValue = oldStats ? clamp(oldStats[key]) : value;
        animateBar(bar, oldValue, value);
        bar.style.width = (value / max * 100) + "%";
    }
}

function animateBar(bar, oldValue, newValue) {
    bar.classList.remove("glow", "shake");
    if (newValue > oldValue) {
        bar.classList.add("glow");
        setTimeout(() => bar.classList.remove("glow"), 300);
    } else if (newValue < oldValue) {
        bar.classList.add("shake");
        setTimeout(() => bar.classList.remove("shake"), 300);
    }
}

function applyEffects(effects) {
    const oldStats = { ...stats };
    for (let key in effects) {
        if (stats.hasOwnProperty(key)) {
            stats[key] += effects[key];
        }
    }
    updateStatBars(oldStats);
}

// ====== CHAPTER OVERLAY ======
function showChapterOverlay(chapter, title) {
    const overlay = document.getElementById("chapter-overlay");
    const text = document.getElementById("chapter-overlay-text");
    overlay.classList.remove("hidden");
    overlay.classList.add("show");
    text.textContent = `Chapter ${chapter} — ${title}`;
    setTimeout(() => {
        overlay.classList.remove("show");
        setTimeout(() => overlay.classList.add("hidden"), 500);
    }, 1200);
}

// ====== RANDOM EVENTS (OREGON TRAIL STYLE) ======
function triggerRandomEvent() {
    const roll = Math.random();
    let eventText = null;
    let effects = null;

    if (roll < 0.15) {
        eventText = "A sudden blizzard sweeps across the trail. The cold bites deep.";
        effects = { cold: +2, fatigue: +1 };
    } else if (roll < 0.3) {
        eventText = "You find a frozen carcass beneath the snow. A rare meal.";
        effects = { hunger: -2, survival: +1 };
    } else if (roll < 0.45) {
        eventText = "A young wolf challenges you, then backs down. The pack watches.";
        effects = { respect: +2, wildness: +1 };
    } else if (roll < 0.6) {
        eventText = "You slip on hidden ice and crash into the traces.";
        effects = { fatigue: +2, survival: -1 };
    } else if (roll < 0.75) {
        eventText = "The northern lights shimmer above. Something in you feels lighter.";
        effects = { morale: +2 };
    } else if (roll < 0.9) {
        eventText = "The sled overturns in deep snow. The work is brutal.";
        effects = { fatigue: +1, survival: -1, respect: +1 };
    }

    if (eventText && effects) {
        applyEffects(effects);
        const sceneText = document.getElementById("scene-text");
        sceneText.textContent += "\n\n[Event] " + eventText;
    }
}

// ====== SCENES (DEEPER, MORE, BRANCHED) ======
const scenes = [
    // CH1 – Stolen From Home
    {
        id: 0,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "You awaken in a wooden crate on a ship. The air smells of salt and fear.\n\nDo you feel more like a pet or a prisoner?",
        choices: [
            { text: "A pet, confused and loyal", effects: { loyalty: +2, morale: -1 }, next: 1 },
            { text: "A prisoner, angry and wild", effects: { wildness: +2, morale: -1 }, next: 1 },
            { text: "Neither. Just something trapped", effects: { survival: +1 }, next: 1 },
            { text: "You refuse to name what you feel", effects: { morale: -1, survival: +1 }, next: 20 }
        ]
    },
    {
        id: 20,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "The crate rocks with the waves. You brace yourself.\n\nWhat memory of Judge Miller still lingers in your mind?",
        choices: [
            { text: "The warmth of the sunlit veranda", effects: { loyalty: +1, morale: +1 }, next: 1 },
            { text: "The sound of his voice calling your name", effects: { loyalty: +2 }, next: 1 },
            { text: "The feel of grass under your paws", effects: { wildness: +1, morale: +1 }, next: 1 },
            { text: "You push the memory away", effects: { wildness: +1, loyalty: -1 }, next: 1 }
        ]
    },
    {
        id: 1,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "Rough hands shake the crate. You slam against the boards.\n\nIs strength earned through pain or patience?",
        choices: [
            { text: "Through pain", effects: { wildness: +2, survival: -1 }, next: 2 },
            { text: "Through patience", effects: { survival: +1, morale: +1 }, next: 2 },
            { text: "Through obedience", effects: { loyalty: +1 }, next: 21 },
            { text: "Through refusing to break", effects: { survival: +1, morale: +1 }, next: 2 }
        ]
    },
    {
        id: 21,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "You lower your head, letting the moment pass.\n\nDo you believe obedience keeps you safe, or only quiet?",
        choices: [
            { text: "Safe. For now.", effects: { loyalty: +1, survival: +1 }, next: 2 },
            { text: "Quiet, but not safe", effects: { wildness: +1, morale: +1 }, next: 2 },
            { text: "You don't know anymore", effects: { morale: -1 }, next: 2 },
            { text: "You stop thinking and wait", effects: { fatigue: +1 }, next: 2 }
        ]
    },
    {
        id: 2,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "The crate opens. Cold air rushes in. Strange faces stare down at you.",
        choices: [
            { text: "Lunge at the nearest man", effects: { wildness: +2, survival: -1, hunger: +1 }, next: 3 },
            { text: "Step out slowly", effects: { loyalty: +1, survival: +1 }, next: 3 },
            { text: "Stay still and watch", effects: { survival: +1, fatigue: +1 }, next: 22 },
            { text: "Growl low, a warning", effects: { wildness: +1, respect: +1 }, next: 3 }
        ]
    },
    {
        id: 22,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "You study their faces, their eyes, their hands.\n\nDo you see them as masters, threats, or puzzles?",
        choices: [
            { text: "Masters", effects: { loyalty: +2, morale: -1 }, next: 3 },
            { text: "Threats", effects: { wildness: +2, survival: +1 }, next: 3 },
            { text: "Puzzles to be solved", effects: { survival: +1, respect: +1 }, next: 3 },
            { text: "You see nothing but the club", effects: { survival: +1, morale: -1 }, next: 3 }
        ]
    },
    {
        id: 3,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "Snow crunches under boots. A man in a red sweater waits, holding a club.\n\nWhat does loyalty mean when the world is cruel?",
        choices: [
            { text: "Loyalty is weakness", effects: { wildness: +2, loyalty: -1 }, next: 4 },
            { text: "Loyalty is survival", effects: { loyalty: +2, survival: +1 }, next: 4 },
            { text: "Loyalty is a memory of home", effects: { morale: +1 }, next: 23 },
            { text: "Loyalty is a chain you must break", effects: { wildness: +2, morale: +1 }, next: 4 }
        ]
    },
    {
        id: 23,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "story",
        text: "You remember gentle hands and soft words.\n\nDoes that memory make this moment easier or harder?",
        choices: [
            { text: "Easier. You know kindness exists.", effects: { morale: +1, loyalty: +1 }, next: 4 },
            { text: "Harder. This feels like betrayal.", effects: { wildness: +1, morale: -1 }, next: 4 },
            { text: "Both. The world is split in two.", effects: { survival: +1 }, next: 4 },
            { text: "You bury the memory deep.", effects: { wildness: +1, loyalty: -1 }, next: 4 }
        ]
    },
    {
        id: 4,
        chapter: 1,
        chapterTitle: "Stolen From Home",
        type: "battle",
        text: "The man in the red sweater raises the club. You feel the old life tearing away.",
        enemy: "redSweater",
        nextWin: 5,
        nextLose: 5
    },

    // CH2 – The Law of Club
    {
        id: 5,
        chapter: 2,
        chapterTitle: "The Law of Club",
        type: "story",
        text: "You have learned the law of club and fang. A new life begins in the North.\n\nDo you trust humans after this?",
        choices: [
            { text: "Never again", effects: { wildness: +2, loyalty: -2 }, next: 6 },
            { text: "Only the ones who are kind", effects: { loyalty: +1, survival: +1 }, next: 6 },
            { text: "You trust no one, only yourself", effects: { survival: +2, morale: -1 }, next: 24 },
            { text: "You don't have time to think about trust", effects: { fatigue: +1 }, next: 6 }
        ]
    },
    {
        id: 24,
        chapter: 2,
        chapterTitle: "The Law of Club",
        type: "story",
        text: "You move through camp like a shadow.\n\nIs isolation a shield or a wound?",
        choices: [
            { text: "A shield", effects: { survival: +1, wildness: +1 }, next: 6 },
            { text: "A wound", effects: { morale: -1, loyalty: +1 }, next: 6 },
            { text: "Both, depending on the day", effects: { survival: +1 }, next: 6 },
            { text: "You refuse to name it", effects: { morale: -1 }, next: 6 }
        ]
    },
    {
        id: 6,
        chapter: 2,
        chapterTitle: "The Law of Club",
        type: "story",
        text: "You join a sled team. The traces bite into your shoulders, but you endure.",
        choices: [
            { text: "Pull with all your strength", effects: { survival: +1, loyalty: +1, fatigue: +1 }, next: 7 },
            { text: "Save your energy", effects: { survival: +1, fatigue: -1 }, next: 25 },
            { text: "Watch the other dogs", effects: { respect: +1, survival: +1 }, next: 7 },
            { text: "Test the limits of the traces", effects: { wildness: +1, survival: +1 }, next: 7 }
        ]
    },
    {
        id: 25,
        chapter: 2,
        chapterTitle: "The Law of Club",
        type: "story",
        text: "You learn to measure effort, to pace yourself.\n\nIs survival a sprint or a long pull?",
        choices: [
            { text: "A sprint. Every moment counts.", effects: { survival: +1, fatigue: +1 }, next: 7 },
            { text: "A long pull. You must endure.", effects: { survival: +2 }, next: 7 },
            { text: "Both. You adapt as needed.", effects: { survival: +1, respect: +1 }, next: 7 },
            { text: "You don't think, you just pull.", effects: { fatigue: +1 }, next: 7 }
        ]
    },
    {
        id: 7,
        chapter: 2,
        chapterTitle: "The Law of Club",
        type: "story",
        text: "A starving dog collapses beside the trail.\n\nDo you help, or keep moving?",
        choices: [
            { text: "Help, even if it slows you", effects: { loyalty: +2, fatigue: +1, hunger: +1 }, next: 8 },
            { text: "Keep moving. You must survive", effects: { survival: +2, morale: -1 }, next: 26 },
            { text: "Look away and pull harder", effects: { wildness: +1, survival: +1 }, next: 8 },
            { text: "Snarl at the men who ignore it", effects: { wildness: +1, respect: +1 }, next: 8 }
        ]
    },
    {
        id: 26,
        chapter: 2,
        chapterTitle: "The Law of Club",
        type: "story",
        text: "You leave the fallen dog behind.\n\nDoes that choice make you stronger or emptier?",
        choices: [
            { text: "Stronger. You had no choice.", effects: { survival: +1, morale: -1 }, next: 8 },
            { text: "Emptier. Something inside you hurts.", effects: { morale: -2, loyalty: +1 }, next: 8 },
            { text: "Both. The trail takes and gives.", effects: { survival: +1 }, next: 8 },
            { text: "You refuse to think about it.", effects: { fatigue: +1 }, next: 8 }
        ]
    },

    // CH3 – The Sled Team
    {
        id: 8,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "story",
        text: "Spitz eyes you with hostility. Each day, the tension grows.\n\nDo you feel more like a wolf or a dog today?",
        choices: [
            { text: "A wolf", effects: { wildness: +2, respect: +1 }, next: 9 },
            { text: "A dog", effects: { loyalty: +2 }, next: 9 },
            { text: "Something in between", effects: { morale: +1 }, next: 27 },
            { text: "Neither. You are something new.", effects: { wildness: +1, survival: +1 }, next: 9 }
        ]
    },
    {
        id: 27,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "story",
        text: "You walk the line between worlds.\n\nDoes that make you unstable or powerful?",
        choices: [
            { text: "Unstable. You feel torn.", effects: { morale: -1 }, next: 9 },
            { text: "Powerful. You can choose.", effects: { survival: +1, wildness: +1 }, next: 9 },
            { text: "Both. It depends on the day.", effects: { morale: +1 }, next: 9 },
            { text: "You stop trying to define it.", effects: { fatigue: +1 }, next: 9 }
        ]
    },
    {
        id: 9,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "story",
        text: "Under the northern lights, the team grows restless. A fight feels inevitable.",
        choices: [
            {
                text: "Prepare yourself for the challenge",
                effects: { survival: +1, wildness: +1, fatigue: +1 },
                nextByStats: [
                    { condition: s => s.wildness >= 5, next: 10 },
                    { condition: s => s.wildness < 5, next: 11 }
                ]
            },
            {
                text: "Stay close to the others",
                effects: { loyalty: +1, respect: +1 },
                next: 11
            },
            {
                text: "Study Spitz's weaknesses",
                effects: { survival: +1, respect: +1 },
                next: 28
            },
            {
                text: "Imagine life without him",
                effects: { wildness: +1, morale: +1 },
                next: 11
            }
        ]
    },
    {
        id: 28,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "story",
        text: "You watch his gait, his temper, his pride.\n\nIs leadership taken by force or earned over time?",
        choices: [
            { text: "Taken by force", effects: { wildness: +2, respect: +1 }, next: 10 },
            { text: "Earned over time", effects: { loyalty: +1, respect: +1 }, next: 11 },
            { text: "Both. The pack respects results.", effects: { survival: +1, respect: +1 }, next: 10 },
            { text: "You don't care, you just want him gone.", effects: { wildness: +1 }, next: 10 }
        ]
    },
    {
        id: 10,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "story",
        text: "You feel power in your limbs. The pack senses your rising strength.",
        choices: [
            { text: "Challenge Spitz openly", effects: { wildness: +2, respect: +1 }, next: 12 },
            { text: "Wait for the perfect moment", effects: { survival: +1 }, next: 12 },
            { text: "Provoke him into making a mistake", effects: { wildness: +1, survival: +1 }, next: 12 },
            { text: "Let the pack push you forward", effects: { respect: +1 }, next: 12 }
        ]
    },
    {
        id: 11,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "story",
        text: "You bide your time, watching Spitz's every move. The snow hides many secrets.",
        choices: [
            { text: "Ambush him when he is distracted", effects: { wildness: +1, survival: +1 }, next: 12 },
            { text: "Let him make the first move", effects: { survival: +1, fatigue: +1 }, next: 12 },
            { text: "Test him with small challenges", effects: { respect: +1 }, next: 12 },
            { text: "Imagine the pack with you at the front", effects: { morale: +1, respect: +1 }, next: 12 }
        ]
    },
    {
        id: 12,
        chapter: 3,
        chapterTitle: "The Sled Team",
        type: "battle",
        text: "Spitz steps forward, teeth bared. The pack circles. This is your moment.",
        enemy: "spitz",
        nextWin: 13,
        nextLose: 13
    },

    // CH4 – Leadership
    {
        id: 13,
        chapter: 4,
        chapterTitle: "The Fight for Leadership",
        type: "story",
        text: "Spitz falls. The pack looks to you. A new leader rises in the snow.\n\nHow will you lead?",
        choices: [
            { text: "With strength and fear", effects: { wildness: +3, respect: +2 }, next: 14 },
            { text: "With balance and care", effects: { loyalty: +2, survival: +1, respect: +1 }, next: 29 },
            { text: "With distance, as a lone power", effects: { survival: +2, morale: -1 }, next: 14 },
            { text: "You don't choose. The pack chooses you.", effects: { respect: +2 }, next: 14 }
        ]
    },
    {
        id: 29,
        chapter: 4,
        chapterTitle: "The Fight for Leadership",
        type: "story",
        text: "You keep the team moving, fed, and alive.\n\nIs leadership a burden or a gift?",
        choices: [
            { text: "A burden", effects: { fatigue: +1, survival: +1 }, next: 14 },
            { text: "A gift", effects: { morale: +1, respect: +1 }, next: 14 },
            { text: "Both. It weighs and lifts you.", effects: { survival: +1, morale: +1 }, next: 14 },
            { text: "You don't think about it. You just lead.", effects: { fatigue: +1 }, next: 14 }
        ]
    },
    {
        id: 14,
        chapter: 4,
        chapterTitle: "The Fight for Leadership",
        type: "story",
        text: "In time, you find John Thornton, a man who treats you with kindness.\n\nWhat does his kindness awaken in you?",
        choices: [
            { text: "A fierce new loyalty", effects: { loyalty: +3, morale: +1 }, next: 30 },
            { text: "A fear of losing him", effects: { survival: +1, morale: -1 }, next: 15 },
            { text: "A confusion between wild and tame", effects: { wildness: +1, loyalty: +1 }, next: 15 },
            { text: "A longing you can't name", effects: { morale: +1 }, next: 15 }
        ]
    },
    {
        id: 30,
        chapter: 4,
        chapterTitle: "The Fight for Leadership",
        type: "story",
        text: "You rest your head in his hands.\n\nIs love a chain, a shelter, or both?",
        choices: [
            { text: "A chain", effects: { wildness: +1, loyalty: -1 }, next: 15 },
            { text: "A shelter", effects: { loyalty: +2, morale: +1 }, next: 15 },
            { text: "Both", effects: { survival: +1 }, next: 15 },
            { text: "You don't care what it is. You feel it.", effects: { morale: +1 }, next: 15 }
        ]
    },

    // CH5 – The Call
    {
        id: 15,
        chapter: 5,
        chapterTitle: "The Call of the Wild",
        type: "story",
        text: "The call of the wild echoes through the trees. Wolves watch from afar.\n\nIs freedom worth loneliness?",
        choices: [
            {
                text: "Yes. Freedom above all",
                effects: { wildness: +3, loyalty: -1 },
                nextByStats: [
                    { condition: s => s.wildness >= 8, next: 31 },
                    { condition: s => s.wildness < 8, next: 16 }
                ]
            },
            {
                text: "No. Love matters more",
                effects: { loyalty: +3, morale: +1 },
                next: 16
            },
            {
                text: "You want both, somehow",
                effects: { survival: +1, morale: +1 },
                next: 16
            },
            {
                text: "You don't answer yet. You listen.",
                effects: { morale: +1, fatigue: -1 },
                next: 16
            }
        ]
    },
    {
        id: 31,
        chapter: 5,
        chapterTitle: "The Call of the Wild",
        type: "story",
        text: "You run with the wolves beneath the stars.\n\nDo you feel like you are returning to something old, or becoming something new?",
        choices: [
            { text: "Returning to something ancient", effects: { wildness: +2 }, next: 16 },
            { text: "Becoming something new", effects: { survival: +1, morale: +1 }, next: 16 },
            { text: "Both. Old blood, new path.", effects: { wildness: +1, respect: +1 }, next: 16 },
            { text: "You don't think. You just run.", effects: { fatigue: +1 }, next: 16 }
        ]
    },

    // CH6 – Thornton
    {
        id: 16,
        chapter: 6,
        chapterTitle: "Thornton",
        type: "story",
        text: "You range farther each day. One evening, you return to find smoke and silence.",
        choices: [
            { text: "Search the camp", effects: { survival: +1, cold: +1 }, next: 32 },
            { text: "Howl into the night", effects: { wildness: +1, morale: -1 }, next: 17 },
            { text: "Circle the perimeter", effects: { survival: +1, respect: +1 }, next: 17 },
            { text: "Refuse to believe what you smell", effects: { morale: -1 }, next: 17 }
        ]
    },
    {
        id: 32,
        chapter: 6,
        chapterTitle: "Thornton",
        type: "story",
        text: "You nose through ashes, torn canvas, and blood.\n\nIs grief a weight, a fire, or a map?",
        choices: [
            { text: "A weight", effects: { fatigue: +1, morale: -1 }, next: 17 },
            { text: "A fire", effects: { wildness: +1, survival: +1 }, next: 17 },
            { text: "A map", effects: { survival: +1, respect: +1 }, next: 17 },
            { text: "You can't name it. You just feel it.", effects: { morale: -1 }, next: 17 }
        ]
    },
    {
        id: 17,
        chapter: 6,
        chapterTitle: "Thornton",
        type: "story",
        text: "The men who killed Thornton still linger nearby, laughing in the dark.\n\nWhat does justice mean to you now?",
        choices: [
            { text: "Blood for blood", effects: { wildness: +2, survival: +1 }, next: 18 },
            { text: "End their threat, then vanish", effects: { survival: +2, respect: +1 }, next: 18 },
            { text: "Let the wild judge them", effects: { morale: +1, wildness: +1 }, next: 18 },
            { text: "You don't think. You move.", effects: { fatigue: +1 }, next: 18 }
        ]
    },

    // CH7 – Blood on the Snow
    {
        id: 18,
        chapter: 7,
        chapterTitle: "Blood on the Snow",
        type: "battle",
        text: "You face the men who took Thornton's life. Firelight flickers on their rifles.",
        enemy: "humans",
        nextWin: 19,
        nextLose: 19
    },
    {
        id: 19,
        chapter: 7,
        chapterTitle: "Blood on the Snow",
        type: "story",
        text: "The camp is silent. The wild waits. Your path is now your own.",
        choices: [
            { text: "Answer the call completely", effects: { wildness: +2 }, next: "end" },
            { text: "Carry Thornton in your heart", effects: { loyalty: +2 }, next: "end" },
            { text: "Walk between worlds, never choosing fully", effects: { survival: +1, morale: +1 }, next: "end" },
            { text: "Let the snow cover your tracks", effects: { respect: +1 }, next: "end" }
        ]
    }
];

// ====== STORY RENDERING ======
function showScene(id) {
    if (id === "end") return showEnding();

    const scene = scenes.find(s => s.id === id);
    if (!scene) return;

    const previousScene = scenes.find(s => s.id === currentSceneId);
    const firstTimeChapter = (currentSceneId === null || previousScene?.chapter !== scene.chapter);

    if (previousScene && previousScene.chapter !== scene.chapter) {
        showChapterSummary(previousScene.chapter);
    }

    currentSceneId = id;
    inBattle = scene.type === "battle";

    const sceneText = document.getElementById("scene-text");
    const choicesDiv = document.getElementById("choices");
    const battleUI = document.getElementById("battle-ui");
    const chapterLabel = document.getElementById("chapter-label");

    chapterLabel.textContent = `Chapter ${scene.chapter} — ${scene.chapterTitle}`;
    sceneText.textContent = scene.text;
    choicesDiv.innerHTML = "";

    updateBackgroundForScene(scene);

    if (firstTimeChapter) showChapterOverlay(scene.chapter, scene.chapterTitle);

    if (!inBattle) {
        triggerRandomEvent();
    }

    if (inBattle) {
        battleUI.classList.remove("hidden");
        startBattle(scene);
        return;
    } else {
        battleUI.classList.add("hidden");
    }

    scene.choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.classList.add("choice-btn");
        btn.textContent = choice.text;
        btn.onclick = () => {
            playHowl();
            pathLog.push({ sceneId: scene.id, chapter: scene.chapter, choice: choice.text });
            if (choice.effects) {
                applyEffects(choice.effects);
                addChapterScore(scene.chapter, choice.effects);
            }
            const nextId = resolveNext(choice);
            showScene(nextId);
        };
        choicesDiv.appendChild(btn);
    });
}

function resolveNext(choice) {
    if (choice.nextByStats && Array.isArray(choice.nextByStats)) {
        for (const branch of choice.nextByStats) {
            if (!branch.condition || branch.condition(stats)) {
                return branch.next;
            }
        }
    }
    return choice.next;
}

// ====== CHAPTER SCORE TRACKING ======
function addChapterScore(chapter, effects) {
    if (!chapterScores[chapter]) {
        chapterScores[chapter] = {
            wildness: 0, loyalty: 0, survival: 0,
            hunger: 0, fatigue: 0, cold: 0,
            morale: 0, respect: 0
        };
    }
    for (const key in effects) {
        if (chapterScores[chapter].hasOwnProperty(key)) {
            chapterScores[chapter][key] += effects[key];
        }
    }
}

function showChapterSummary(chapter) {
    const summary = chapterScores[chapter];
    if (!summary) return;

    let text = `Chapter ${chapter} Summary:\n`;
    for (const key in summary) {
        if (summary[key] !== 0) {
            const sign = summary[key] > 0 ? "+" : "";
            text += `${key}: ${sign}${summary[key]}\n`;
        }
    }

    const sceneText = document.getElementById("scene-text");
    sceneText.textContent += `\n\n[Chapter Summary]\n${text}`;
}

// ====== GENERIC BATTLE SYSTEM ======
const battleConfigs = {
    redSweater: {
        name: "Man in the Red Sweater",
        maxHP: 80,
        movesEnemy: [
            { name: "Club Swing", damage: 15 },
            { name: "Kick", damage: 10 }
        ]
    },
    spitz: {
        name: "Spitz",
        maxHP: 100,
        movesEnemy: [
            { name: "Bite", damage: 15 },
            { name: "Charge", damage: 20 },
            { name: "Snap", damage: 10 }
        ]
    },
    humans: {
        name: "Men at the Camp",
        maxHP: 120,
        movesEnemy: [
            { name: "Rifle Butt", damage: 18 },
            { name: "Kick", damage: 12 },
            { name: "Shout", damage: 8 }
        ]
    }
};

const playerMoveSets = {
    attack: [
        { name: "Bite", desc: "A fierce bite.", buckDamage: 0, enemyDamage: 14, critChance: 0.2 },
        { name: "Lunge", desc: "A powerful leap.", buckDamage: 0, enemyDamage: 18, critChance: 0.15 },
        { name: "Feint", desc: "Quick, tricky strike.", buckDamage: 0, enemyDamage: 10, critChance: 0.3 }
    ],
    special: [
        { name: "Rend", desc: "Savage attack, but risky.", buckDamage: 8, enemyDamage: 24, critChance: 0.25 },
        { name: "Fury", desc: "Push your limits.", buckDamage: 12, enemyDamage: 28, critChance: 0.3 },
        { name: "Savage Leap", desc: "All-out leap.", buckDamage: 15, enemyDamage: 32, critChance: 0.35 }
    ],
    run: [
        { name: "Flee", desc: "Try to escape the fight.", runAttempt: true },
        { name: "Run to Perrault", desc: "Instinct pulls you toward old memories.", runAttempt: true },
        { name: "Retreat to the Forest", desc: "Melt into the trees.", runAttempt: true }
    ],
    misc: [
        { name: "Howl", desc: "Rally your spirit.", buckDamage: -15, enemyDamage: 0, buff: { morale: +2, wildness: +1 } },
        { name: "Block", desc: "Brace for impact.", buckDamage: -5, enemyDamage: 0 },
        { name: "Dodge", desc: "Avoid the next blow.", buckDamage: -10, enemyDamage: 6 },
        { name: "Circle", desc: "Wolf tactic, test the enemy.", buckDamage: 0, enemyDamage: 8, buff: { respect: +1 } }
    ]
};

function startBattle(scene) {
    const enemyConfig = battleConfigs[scene.enemy];
    currentEnemyConfig = enemyConfig;

    buckHP = 100;
    enemyHP = enemyConfig.maxHP;
    updateBattleBars();

    const enemyNameEl = document.getElementById("enemy-name");
    enemyNameEl.textContent = enemyConfig.name;

    const battleLog = document.getElementById("battle-log");
    const moveList = document.getElementById("battle-move-list");
    const menuButtons = document.querySelectorAll(".battle-menu-btn");

    moveList.innerHTML = "";
    battleLog.textContent = `${enemyConfig.name} appears! Choose your move.`;

    menuButtons.forEach(btn => {
        btn.onclick = () => {
            const menu = btn.getAttribute("data-menu");
            showMoveList(menu, battleLog, scene);
        };
    });

    showMoveList("attack", battleLog, scene);
}

function showMoveList(menu, battleLog, scene) {
    const moveList = document.getElementById("battle-move-list");
    moveList.innerHTML = "";

    const moves = playerMoveSets[menu] || [];
    moves.forEach(move => {
        const btn = document.createElement("button");
        btn.classList.add("battle-btn");
        btn.textContent = move.name;
        btn.title = move.desc;
        btn.onclick = () => {
            if (!inBattle) return;
            playHowl();
            pathLog.push({ sceneId: scene.id, chapter: scene.chapter, choice: `[BATTLE] ${move.name}` });
            playerTurn(move, battleLog, scene);
        };
        moveList.appendChild(btn);
    });
}

function updateBattleBars() {
    const buckBar = document.getElementById("buck-hp-bar");
    const enemyBar = document.getElementById("enemy-hp-bar");

    buckBar.style.width = Math.max(0, buckHP) + "%";
    enemyBar.style.width = Math.max(0, (enemyHP / currentEnemyConfig.maxHP) * 100) + "%";
}

function playerTurn(move, battleLog, scene) {
    let log = `Buck used ${move.name}! `;

    if (move.runAttempt) {
        log += "You try to flee... but the wild holds you here.";
        battleLog.textContent = log;
        setTimeout(() => enemyTurn(battleLog, scene), 700);
        return;
    }

    let enemyDamage = move.enemyDamage || 0;
    let buckDamage = move.buckDamage || 0;

    const moraleBonus = stats.morale / 40;
    const critChance = (move.critChance || 0) + moraleBonus;

    if (enemyDamage > 0 && Math.random() < critChance) {
        enemyDamage = Math.round(enemyDamage * 1.5);
        log += "It's a critical hit! ";
    }

    const fatiguePenalty = 1 - (stats.fatigue / 20);
    enemyDamage = Math.max(0, Math.round(enemyDamage * fatiguePenalty));

    if (enemyDamage) {
        enemyHP -= enemyDamage;
        log += `It dealt ${enemyDamage} damage. `;
    }

    if (buckDamage) {
        buckHP -= buckDamage;
        if (buckDamage < 0) {
            log += `Buck recovered ${-buckDamage} HP. `;
        } else {
            log += `Buck took ${buckDamage} recoil. `;
        }
    }

    if (move.buff) {
        applyEffects(move.buff);
        addChapterScore(scene.chapter, move.buff);
        log += "Buck feels different. ";
    }

    if (stats.cold > 5) {
        const coldDrain = stats.cold - 5;
        buckHP -= coldDrain;
        log += `The cold drains ${coldDrain} more HP. `;
    }

    updateBattleBars();

    if (enemyHP <= 0) {
        battleLog.textContent = log + `${currentEnemyConfig.name} falls.`;
        endBattle(true, scene);
        return;
    }

    if (buckHP <= 0) {
        battleLog.textContent = log + "Buck collapses...";
        endBattle(false, scene);
        return;
    }

    battleLog.textContent = log + `${currentEnemyConfig.name} prepares to strike back.`;
    setTimeout(() => enemyTurn(battleLog, scene), 700);
}

function enemyTurn(battleLog, scene) {
    if (!inBattle) return;

    const attacks = currentEnemyConfig.movesEnemy;
    const attack = attacks[Math.floor(Math.random() * attacks.length)];

    const dodgeChance = stats.respect / 25;
    if (Math.random() < dodgeChance) {
        battleLog.textContent = `${currentEnemyConfig.name} used ${attack.name}, but Buck dodged thanks to his pack instincts!`;
        return;
    }

    buckHP -= attack.damage;
    updateBattleBars();

    let log = `${currentEnemyConfig.name} used ${attack.name}! Buck took ${attack.damage} damage. `;

    if (buckHP <= 0) {
        battleLog.textContent = log + "Buck collapses...";
        endBattle(false, scene);
        return;
    }

    battleLog.textContent = log + "It's your turn.";
}

function endBattle(playerWon, scene) {
    inBattle = false;
    const battleLog = document.getElementById("battle-log");
    const moveList = document.getElementById("battle-move-list");

    moveList.innerHTML = "";

    if (playerWon) {
        const reward = { wildness: +2, survival: +2, respect: +1 };
        applyEffects(reward);
        addChapterScore(scene.chapter, reward);
        battleLog.textContent += " The wild remembers your strength.";
        setTimeout(() => showScene(scene.nextWin), 1200);
    } else {
        const penalty = { survival: -2, morale: -1 };
        applyEffects(penalty);
        addChapterScore(scene.chapter, penalty);
        battleLog.textContent += " The snow grows quiet around you.";
        setTimeout(() => showScene(scene.nextLose), 1200);
    }
}

// ====== ENDING + TEACHER SUMMARY ======
function showEnding() {
    const { wildness, loyalty, survival, hunger, fatigue, cold, morale, respect } = stats;
    const sceneText = document.getElementById("scene-text");
    const choicesDiv = document.getElementById("choices");
    const battleUI = document.getElementById("battle-ui");
    const chapterLabel = document.getElementById("chapter-label");

    battleUI.classList.add("hidden");
    document.getElementById("spitz").style.display = "none";
    document.getElementById("human-enemy").style.display = "none";
    chapterLabel.textContent = "Final Outcome";

    let ending = "";

    if (wildness > loyalty && wildness > survival) {
        ending = "Buck answers the call and becomes leader of the wild pack.";
    } else if (loyalty > wildness) {
        ending = "Buck stays loyal to John Thornton, choosing love over the wild.";
    } else if (survival > 12) {
        ending = "Buck becomes a northern legend, feared and respected.";
    } else {
        ending = "Buck fades quietly into the wilderness, his fate unknown.";
    }

    const summaryLines = pathLog.map(p => `Chapter ${p.chapter}, Scene ${p.sceneId}: ${p.choice}`);
    const summaryText = summaryLines.join("\n");

    const statSummary =
        `Final Stats:\n` +
        `Wildness: ${wildness}\n` +
        `Loyalty: ${loyalty}\n` +
        `Survival: ${survival}\n` +
        `Hunger: ${hunger}\n` +
        `Fatigue: ${fatigue}\n` +
        `Cold: ${cold}\n` +
        `Morale: ${morale}\n` +
        `Pack Respect: ${respect}\n`;

    sceneText.textContent = ending;

    const summaryBox = document.createElement("textarea");
    summaryBox.readOnly = true;
    summaryBox.rows = 12;
    summaryBox.style.width = "100%";
    summaryBox.value =
        "Teacher Summary – Choices Made:\n\n" +
        summaryText +
        "\n\n" +
        statSummary +
        "Reflection Prompt:\nHow did Buck change between home, the sled team, Thornton, and the final call of the wild?";

    choicesDiv.innerHTML = "";
    choicesDiv.appendChild(summaryBox);
}

// ====== INIT ======
updateStatBars();
showScene(0);
