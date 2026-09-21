let score = 0;
let currentQuestion = 0;
let selectedAnswer = null;
let currentChallenge = 1;
let timerInterval = null;
let secondsElapsed = 0;
let advanceTimeout = null;
let audioCtx = null;
let playerName = "Participant";
let verifyInFlight = false;

// Each mission maps to its own set of questions, per the teacher's
// Missions handout. Numbers are torque-balance problems: the correct
// option/hook is the one where (weight x hook distance) matches on
// both sides. Learners pick the MCQ answer, physically hang the
// matching weight on the stated hook, then VERIFY checks the seesaw
// is actually level via the webcam.
const missionQuestions = {

    1: [
        {
            question: "A 200 g block is on the 4th left hook. Where should you place the 100 g block on the right to balance the stabilizer?",
            options: ["4th hook", "6th hook", "8th hook", "10th hook"],
            answer: "8th hook"
        },
        {
            question: "A 300 g weight is on the 2nd hook from the pivot on the right. A 150 g weight sits on the left, leaving 3 hooks from the pivot. On which hook should the 150 g weight be placed to balance the stabilizer?",
            options: ["2nd hook", "4th hook", "6th hook", "8th hook"],
            answer: "6th hook"
        }
    ],

    2: [
        {
            question: "A 100 g weight is on the 8th hook on the left, and a 150 g weight on the 4th hook on the right — it tilts. You can change only the right-side weight, not the hook. Which weight makes it stable?",
            options: ["50 g", "100 g", "200 g", "300 g"],
            answer: "200 g"
        },
        {
            question: "A 300 g weight is on the 4th hook from the pivot on the right, and it tilts. You may place a weight greater than 100 g but less than 400 g on Hook 6 on the left. Which weight balances it?",
            options: ["150 g", "200 g", "300 g", "350 g"],
            answer: "200 g"
        }
    ],

    3: [
        {
            question: "Left side: 200 g at Hook 3. Which right-side arrangement balances it?",
            options: ["100 g at Hook 5", "100 g at Hook 6", "150 g at Hook 4", "50 g at Hook 8"],
            answer: "100 g at Hook 6"
        },
        {
            question: "Left side: 500 g at Hook 6. Right side currently has 200 g at Hook 6. Using a 100 g, 200 g, or 300 g block, which weight should you add to the right side, and at which hook, to balance it?",
            options: ["100 g at Hook 15", "200 g at Hook 9", "300 g at Hook 6", "200 g at Hook 6"],
            answer: "200 g at Hook 9"
        }
    ]

};

const missionTitles = {
    1: "Mission 1: Hook It Right!",
    2: "Mission 2: Crack the Weight!",
    3: "Mission 3: Master the Balance!"
};

// set by startGame() to whichever mission's question list is active
let questions = missionQuestions[1];

function getAudioContext(){

    if(!audioCtx){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // browsers auto-suspend contexts until a user gesture,
    // and can suspend them again after inactivity — resume every time
    if(audioCtx.state === "suspended"){
        audioCtx.resume();
    }

    return audioCtx;

}

function playCorrectSound(){

    const ctx = getAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 900;
    gain.gain.value = 0.2;

    osc.start();
    osc.stop(ctx.currentTime + 0.2);

}

function playWrongSound(){

    const ctx = getAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    gain.gain.value = 0.2;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 200;

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

}

function showChallenges(){

    document.getElementById("home")
        .classList.add("hidden");

    document.getElementById("challengePage")
        .classList.remove("hidden");
}

function startGame(challengeNumber){

    // unlock/resume audio right away on this user click,
    // so the first correct/wrong sound isn't the one that gets blocked
    getAudioContext();

    const nameInput = document.getElementById("playerName").value.trim();
    playerName = nameInput || "Participant";

    currentChallenge = challengeNumber;
    currentQuestion = 0;
    score = 0;

    questions = missionQuestions[challengeNumber] || missionQuestions[1];

    document.getElementById("score").innerHTML = score;
    document.getElementById("questionNumber").innerHTML = 1;
    document.getElementById("questionTotal").innerHTML = questions.length;

    document.getElementById("challengePage")
        .classList.add("hidden");

    document.getElementById("gamePage")
        .classList.remove("hidden");

    startTimer();
    loadQuestion();

}

function startTimer(){

    secondsElapsed = 0;
    updateTimerDisplay();

    clearInterval(timerInterval);

    timerInterval = setInterval(()=>{
        secondsElapsed++;
        updateTimerDisplay();
    },1000);

}

function updateTimerDisplay(){

    const minutes = Math.floor(secondsElapsed / 60)
        .toString().padStart(2,"0");

    const seconds = (secondsElapsed % 60)
        .toString().padStart(2,"0");

    document.getElementById("timer").innerHTML =
        `${minutes}:${seconds}`;

}

function loadQuestion(){

    let q = questions[currentQuestion];

    document.getElementById("questionText")
        .innerHTML = q.question;

    document.getElementById("questionNumber")
        .innerHTML = currentQuestion + 1;

    let container =
        document.getElementById("optionsContainer");

    container.innerHTML = "";

    selectedAnswer = null;

    document.getElementById("verifyBtn")
        .classList.remove("hidden");

    resetVerifyButton();

    q.options.forEach(option=>{

        const div = document.createElement("div");
        div.className = "option";
        div.textContent = option;
        div.onclick = () => selectAnswer(option, div);

        container.appendChild(div);

    });

}

function selectAnswer(answer, element){

    selectedAnswer = answer;

    document.querySelectorAll(".option").forEach(opt=>{
        opt.classList.remove("selected");
    });

    element.classList.add("selected");

}

async function checkAnswer(){

    if(selectedAnswer === null){

        alert("Select an answer, then hang the matching weight on the seesaw before verifying.");

        return;

    }

    if(verifyInFlight){
        return;
    }

    verifyInFlight = true;

    const verifyBtn = document.getElementById("verifyBtn");
    verifyBtn.disabled = true;
    verifyBtn.classList.add("checking");
    verifyBtn.innerHTML = "CHECKING SEESAW...";

    // lock the options so the pick can't change while we're verifying
    document.querySelectorAll(".option").forEach(opt=>{
        opt.style.pointerEvents = "none";
    });

    let result;

    try{

        const response = await fetch("/verify");
        result = await response.json();

    } catch(err){

        alert(
            "Couldn't reach the balance-checking server.\n" +
            "Make sure app.py is running (python app.py) and this page was opened from it."
        );

        resetVerifyButton();
        verifyInFlight = false;
        return;

    }

    if(!result.success){

        alert(
            "Camera couldn't verify the seesaw:\n" + (result.error || "Unknown error") +
            "\n\nCheck that both colored stickers are visible to the camera, then try again."
        );

        resetVerifyButton();
        verifyInFlight = false;
        return;

    }

    if(result.balanced){

        score++;

        document.getElementById("score")
            .innerHTML = score;

        showCorrect();

    } else {

        showWrong();

    }

    verifyBtn.classList.add("hidden");
    verifyInFlight = false;

    // auto-advance to the next question after a short pause
    clearTimeout(advanceTimeout);
    advanceTimeout = setTimeout(nextQuestion, 1400);

}

function resetVerifyButton(){

    const verifyBtn = document.getElementById("verifyBtn");
    verifyBtn.disabled = false;
    verifyBtn.classList.remove("checking");
    verifyBtn.innerHTML = "VERIFY ANSWER";

    document.querySelectorAll(".option").forEach(opt=>{
        opt.style.pointerEvents = "auto";
    });

}

function nextQuestion(){

    clearTimeout(advanceTimeout);

    currentQuestion++;

    if(currentQuestion >= questions.length){

        clearInterval(timerInterval);

        showResults();

        return;

    }

    loadQuestion();

}

function showCorrect(){

    playCorrectSound();

    const el = document.getElementById("correctScreen");
    el.classList.add("flash");

    setTimeout(()=>{
        el.classList.remove("flash");
    },1000);

}

function showWrong(){

    playWrongSound();

    const el = document.getElementById("wrongScreen");
    el.classList.add("flash");

    setTimeout(()=>{
        el.classList.remove("flash");
    },1000);

}

function endChallenge(){

    clearInterval(timerInterval);
    clearTimeout(advanceTimeout);

    const confirmEnd = confirm(
        "End the challenge now?\nCurrent score: " + score
    );

    if(confirmEnd){
        goHome();
    } else {
        // resume the timer from where it was, if they change their mind
        timerInterval = setInterval(()=>{
            secondsElapsed++;
            updateTimerDisplay();
        },1000);
    }

}

function goHome(){

    clearInterval(timerInterval);
    clearTimeout(advanceTimeout);

    document.querySelectorAll(".glass").forEach(el=>{
        el.classList.add("hidden");
    });

    document.getElementById("home")
        .classList.remove("hidden");

}

function showResults(){

    const total = questions.length;
    const percent = Math.round((score / total) * 100);

    const resultPage = document.getElementById("resultPage");

    document.getElementById("gamePage").classList.add("hidden");
    resultPage.classList.remove("hidden");

    resultPage.classList.remove("tier-high","tier-mid","tier-low");

    document.getElementById("resultScore").innerHTML =
        score + "/" + total;

    document.getElementById("resultPercent").innerHTML =
        percent + "%";

    let tier, icon, title, message;

    if(percent >= 70){

        tier = "tier-high";
        icon = "🎉";
        title = "OUTSTANDING!";
        message = "You're a Balance Master! Incredible work out there!";

    } else if(percent >= 40){

        tier = "tier-mid";
        icon = "🌟";
        title = "GREAT EFFORT!";
        message = "Solid progress! You're getting sharper every round!";

    } else {

        tier = "tier-low";
        icon = "💪";
        title = "KEEP GOING!";
        message = "Every attempt makes you stronger. You've got this — try again!";

    }

    resultPage.classList.add(tier);

    document.getElementById("resultIcon").innerHTML = icon;
    document.getElementById("resultTitle").innerHTML = title;
    document.getElementById("resultMessage").innerHTML = message;

    // animate the progress bar filling in after a tiny delay
    const bar = document.getElementById("resultBarFill");
    bar.style.width = "0%";

    setTimeout(()=>{
        bar.style.width = percent + "%";
    },100);

    if(tier === "tier-high"){
        spawnConfetti();
    } else if(tier === "tier-mid"){
        spawnSparkles();
    } else {
        spawnSparkles(6);
    }

    saveAttempt(total);

}

async function saveAttempt(totalQuestions){

    try{

        await fetch("/save_attempt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: playerName,
                challenge: currentChallenge,
                score: score,
                total_questions: totalQuestions,
                time_taken: secondsElapsed
            })
        });

    } catch(err){
        // non-fatal — the celebration screen still shows even if saving fails
        console.warn("Could not save attempt:", err);
    }

}

async function recalibrate(){

    const confirmRun = confirm(
        "Level the seesaw with no weights on it, then click OK to re-zero the balance baseline."
    );

    if(!confirmRun){
        return;
    }

    try{

        const response = await fetch("/recalibrate", { method: "POST" });
        const result = await response.json();

        if(result.success){
            alert("Recalibrated! Baseline angle: " + result.baseline_angle + "°");
        } else {
            alert("Couldn't recalibrate: " + (result.error || "Unknown error"));
        }

    } catch(err){
        alert("Couldn't reach the server. Is app.py running?");
    }

}

async function openLeaderboard(){

    document.querySelectorAll(".glass").forEach(el=>{
        el.classList.add("hidden");
    });

    document.getElementById("leaderboardPage").classList.remove("hidden");

    const listEl = document.getElementById("leaderboardList");
    listEl.innerHTML = "<div class='leaderboard-empty'>Loading...</div>";

    try{

        const response = await fetch("/leaderboard");
        const rows = await response.json();

        if(!rows || rows.length === 0){
            listEl.innerHTML = "<div class='leaderboard-empty'>No attempts yet — be the first!</div>";
            return;
        }

        listEl.innerHTML = "";

        rows.forEach((row, index)=>{

            const item = document.createElement("div");
            item.className = "leaderboard-row";

            const minutes = Math.floor(row.time_taken / 60).toString().padStart(2,"0");
            const seconds = (row.time_taken % 60).toString().padStart(2,"0");

            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${row.name}</span>
                <span class="leaderboard-meta">
                    Ch.${row.challenge} · ${row.score}/${row.total_questions} · ${minutes}:${seconds}
                </span>
            `;

            listEl.appendChild(item);

        });

    } catch(err){
        listEl.innerHTML = "<div class='leaderboard-empty'>Couldn't load the leaderboard. Is app.py running?</div>";
    }

}

function spawnConfetti(){

    const layer = document.getElementById("confettiLayer");
    layer.innerHTML = "";

    const colors = ["#00e5ff","#7c3aed","#22c55e","#f59e0b","#ef4444","#ffffff"];
    const pieceCount = 90;

    for(let i = 0; i < pieceCount; i++){

        const piece = document.createElement("div");
        piece.className = "confetti-piece";

        const size = 6 + Math.random() * 6;
        const duration = 2.2 + Math.random() * 1.6;
        const delay = Math.random() * 0.6;

        piece.style.left = (Math.random() * 100) + "%";
        piece.style.width = size + "px";
        piece.style.height = (size * 0.4) + "px";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = duration + "s";
        piece.style.animationDelay = delay + "s";

        layer.appendChild(piece);

    }

    setTimeout(()=>{
        layer.innerHTML = "";
    },4200);

}

function spawnSparkles(count){

    const layer = document.getElementById("confettiLayer");
    layer.innerHTML = "";

    const symbols = ["✨","⭐","🌟"];
    const pieceCount = count || 18;

    for(let i = 0; i < pieceCount; i++){

        const piece = document.createElement("div");
        piece.className = "sparkle-piece";
        piece.textContent = symbols[Math.floor(Math.random() * symbols.length)];

        const duration = 2.4 + Math.random() * 1.4;
        const delay = Math.random() * 1.2;

        piece.style.left = (Math.random() * 100) + "%";
        piece.style.animationDuration = duration + "s";
        piece.style.animationDelay = delay + "s";

        layer.appendChild(piece);

    }

    setTimeout(()=>{
        layer.innerHTML = "";
    },4200);

}

function retryChallenge(){

    document.getElementById("resultPage").classList.add("hidden");
    startGame(currentChallenge);

}