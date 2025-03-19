/** @param {NS} ns **/

// Configuration variables
const MONEY_THRESHOLD = 0.75;       // Percentage of server money to steal
const SECURITY_THRESHOLD = 5;        // Maximum security increase allowed
const SERVER_RAM_LIMIT = 64;         // Min RAM to consider for purchased servers
const PURCHASE_SERVER_RAM = 8;       // Initial RAM for auto-purchased servers

// Scan and return all servers
function getServers(ns) {
    let servers = ["home"];
    let queue = ["home"];
    
    while (queue.length > 0) {
        let current = queue.pop();
        let scanned = ns.scan(current);

        for (let server of scanned) {
            if (!servers.includes(server)) {
                servers.push(server);
                queue.push(server);
            }
        }
    }

    return servers;
}

// Get the best target server based on money and security
function findBestTarget(ns, servers) {
    let bestTarget = "";
    let maxMoney = 0;

    for (let server of servers) {
        if (!ns.hasRootAccess(server)) continue;
        if (ns.getServerMaxMoney(server) === 0) continue;

        let money = ns.getServerMoneyAvailable(server);
        let security = ns.getServerSecurityLevel(server);
        let maxMoneyServer = ns.getServerMaxMoney(server);

        if (money > maxMoney * MONEY_THRESHOLD && security < SECURITY_THRESHOLD) {
            bestTarget = server;
            maxMoney = maxMoneyServer;
        }
    }

    return bestTarget;
}

// Automatically purchase servers with max affordable RAM
function buyServers(ns) {
    const maxServers = ns.getPurchasedServerLimit();
    const ramCost = ns.getPurchasedServerCost(PURCHASE_SERVER_RAM);

    for (let i = 0; i < maxServers; i++) {
        if (ns.getPurchasedServers().length >= maxServers) break;

        if (ns.getServerMoneyAvailable("home") > ramCost) {
            const hostname = ns.purchaseServer(`pserv-${i}`, PURCHASE_SERVER_RAM);
            ns.tprint(`Purchased server: ${hostname}`);
        }
    }
}

// Upgrade server RAM when you have excess money
function upgradeServers(ns) {
    const purchased = ns.getPurchasedServers();

    for (let server of purchased) {
        let ram = ns.getServerMaxRam(server);
        let cost = ns.getPurchasedServerCost(ram * 2);

        if (ram < SERVER_RAM_LIMIT && ns.getServerMoneyAvailable("home") > cost) {
            ns.killall(server);
            ns.deleteServer(server);
            ns.purchaseServer(server, ram * 2);
            ns.tprint(`Upgraded server: ${server} to ${ram * 2}GB`);
        }
    }
}

export async function main(ns) {
    ns.disableLog("ALL");

    while (true) {
        let servers = getServers(ns);
        let target = findBestTarget(ns, servers);

        if (!target) {
            ns.tprint("No suitable target found. Waiting...");
            await ns.sleep(10000);
            continue;
        }

        // Deploy scripts on available servers
        for (let server of servers) {
            if (!ns.hasRootAccess(server)) {
                try {
                    ns.brutessh(server);
                    ns.ftpcrack(server);
                    ns.relaysmtp(server);
                    ns.nuke(server);
                } catch (e) {
                    continue;  // No exploits available
                }
            }

            let ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            let scriptRam = ns.getScriptRam("hack.js");
            let threads = Math.floor(ram / scriptRam);

            if (threads > 0) {
                await ns.scp(["weaken.js", "grow.js", "hack.js"], server);
                
                ns.exec("weaken.js", server, Math.floor(threads * 0.4), target);
                ns.exec("grow.js", server, Math.floor(threads * 0.4), target);
                ns.exec("hack.js", server, Math.floor(threads * 0.2), target);
            }
        }

        // Auto-purchase and upgrade servers
        buyServers(ns);
        upgradeServers(ns);

        ns.print(`Hacking ${target}`);
        await ns.sleep(10000);
    }
}
