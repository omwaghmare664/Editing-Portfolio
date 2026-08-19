// ==========================================
// CLIENTS DATA - Just add your clients here
// ==========================================
const clientsData = [
    {
        name: "Srishti Playz",
        handle: "@srishtiplayz",
        avatar: "https://yt3.ggpht.com/swk0ZCwtmtq4MAYxJkoH66ER9ZsLItEVxv9Sx1TkUs-9wKrb7s57gRegpzUaDsodoEEyD9ejXw=s176-c-k-c0x00ffffff-no-rj-mo",
        subscribers: "187k",
        badge: "Long form editing"
    },
    {
        name: "Dr. Vivek Galani",
        handle: "@RQCHairTransplant",
        avatar: "https://yt3.googleusercontent.com/ytc/AIdro_l1RqhMY7w3y3J-7dGyYQcQ_aVYU13kTac4a7h6l1AN6fc=s120-c-k-c0x00ffffff-no-rj",
        subscribers: "24k",
        badge: "Short form editing"
    },
    {
        name: "PW College Wallah",
        handle: "@CollegeWallahbyPWSkills",
        avatar: "https://yt3.googleusercontent.com/b7X5taC9A8ivQ50vZE8hUC0PuxvlrZlq5bvJAWjOpNr7P_Ffc-V0KHLuCGNPlGWsfWgqs4v1-A=s160-c-k-c0x00ffffff-no-rj",
        subscribers: "1m",
        badge: "Short form editing"
    },
    {
        name: "PW Institute of Innovation",
        handle: "@PW-IOI",
        avatar: "https://yt3.googleusercontent.com/mXREkBuLGPj_1h5X1QaIqOfJmGiSlHTrVZQmK8R2BSmZppCmSVr43M9MQEyNbzGUHfEr45zz-Q=s160-c-k-c0x00ffffff-no-rj",
        subscribers: "28k",
        badge: "Short form editing"
    },
];

// ==========================================
// RENDER CLIENTS
// ==========================================
function renderClients() {
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;
    
    grid.innerHTML = clientsData.map(client => `
        <div class="client-card" onclick="window.open('https://youtube.com/${client.handle}') ">
            <div class="client-badge">${client.badge || 'Client'}</div>
            <div class="client-avatar">
                <img src="${client.avatar}" alt="${client.name}" loading="lazy">
            </div>
            <div class="client-name">
                ${client.name}
                <span class="client-verified"><i class="fas fa-check-circle"></i></span>
            </div>
            <div class="client-handle">${client.handle}</div>
            <div class="client-stats">
                <span><i class="fas fa-users"></i> ${client.subscribers}</span>
            </div>
        </div>
    `).join('');
}

// Run it
if (document.getElementById('clientsGrid')) {
    renderClients();
}
