//sword
// Define the player object with properties for position, health, and facing direction
const player = {
    name: "Hero",
    health: 100,
    x: 100,
    y: 100,
    width: 32,
    height: 32,
    facing: "right"
};

// Define the sword object with properties for damage, range, width, and swing state

const sword = {
    damage: 25,
    range: 40,
    width: 30,
    isSwinging: false,
    swingDuration: 150, // Duration of the swing in milliseconds
    cooldown: 400, // Cooldown time in milliseconds
    lastSwingTime: 0, // Timestamp of the last swing
};

// Function to handle the sword swing action

window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat) {
        swingSword(); // Call the swingSword function when the spacebar is pressed
    }
});

function swingSword() {
    const now = Date.now();   // Get the current timestamp in milliseconds
    if (now - sword.lastSwingTime < sword.cooldown)
        return; // If the cooldown period hasn't passed, exit the function

    sword.isSwinging = true; // Set the sword's swinging state to true
    sword.lastSwingTime = now; // Update the last swing time to the current timestamp

    setTimeout(() => {
        sword.isSwinging = false; // After the swing duration, set the swinging state to false
    }, sword.swingDuration);
}

function getSwordHitbox() { //check where player may be facing and place the sword hitbox accordingly
    switch (player.facing) {
        case "right":
            return {
                x: player.x + player.width, // Position the hitbox to the right of the player
                y: player.y + player.height / 2 - sword.width / 2, // Center the hitbox vertically
                width: sword.range, // Set the width of the hitbox to the sword's range
                height: sword.width // Set the height of the hitbox to the sword's width
            };

        case "left":
            return {
                x: player.x - sword.range, // Position the hitbox to the left of the player
                y: player.y + player.height / 2 - sword.width / 2, // Center the hitbox vertically
                width: sword.range, // Set the width of the hitbox to the sword's range
                height: sword.width // Set the height of the hitbox to the sword's width
            };

        case "up":
            return {
                x: player.x + player.width / 2 - sword.width / 2, // Center the hitbox horizontally
                y: player.y - sword.range, // Position the hitbox above the player
                width: sword.width, // Set the width of the hitbox to the sword's width
                height: sword.range // Set the height of the hitbox to the sword's range
            };

        case "down":
            return {
                x: player.x + player.width / 2 - sword.width / 2, // Center the hitbox horizontally
                y: player.y + player.height, // Position the hitbox below the player
                width: sword.width, // Set the width of the hitbox to the sword's width
                height: sword.range // Set the height of the hitbox to the sword's range
            };

        default:
            return {
                x: player.x + player.width,
                y: player.y + player.height / 2 - sword.width / 2,
                width: sword.range,
                height: sword.width
            };
    }
}


//Check if 2 rectangles overlap (collision detection)

function isColliding(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width && // Check if the right edge of rect1 is to the left of the right edge of rect2
        rect1.x + rect1.width > rect2.x && // Check if the left edge of rect1 is to the right of the left edge of rect2
        rect1.y < rect2.y + rect2.height && // Check if the bottom edge of rect1 is above the bottom edge of rect2
        rect1.y + rect1.height > rect2.y // Check if the top edge of rect1 is below the top edge of rect2
    );
}

//check for hits while the sword is swinging
function update(enemies) {
    if (sword.isSwinging) { // If the sword is currently swinging
        const swordHitbox = getSwordHitbox();

        // To loop through enemy in every game

        enemies.forEach((enemy) => {

            if (!enemy.alreadyHit && isColliding(swordHitbox, enemy)) {
                enemy.hp -= sword.damage;   // subtract sword damage from enemy health
                enemy.alreadyHit = true;
            }
        });
    }
    else {
        enemies.forEach((enemy) => (enemy.alreadyHit = false));
    }
}

function draw(ctx) {
    ctx.fillStyle = "blue";
    ctx.fillRect(player.x, player.y, player.width, player.height);

    if (sword.isSwinging) {
        const hitbox = getSwordHitbox();
        ctx.fillStyle = "Silver";
        ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height); //draw slash box

    }
}



