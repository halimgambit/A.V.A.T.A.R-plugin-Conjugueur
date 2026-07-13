import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function init() {}

export async function action(data, callback) {
    try {
        const tblActions = {
            conjugate: () => conjugate(data, data.client)                  
        };
        info("Conjugueur:", data.action.command, "from", data.client);
        await tblActions[data.action.command]();
    } catch (err) {
        if (data.client) Avatar.Speech.end(data.client);
        if (err.message) error(err.message);
    }   
    callback();
}

const conjugate = async (data, client) => {
    const sentence = data.rawSentence || data.action?.sentence || "";
    if (!sentence) {
        return Avatar.speak("Je n'ai pas compris le verbe à conjuguer.", client,
            () => Avatar.Speech.end(client)
        );
    }

    const rawSentence = sentence.toLowerCase().trim();

    const tempsDisponibles = [
        {nom: "Passé composé", mots: ["passé composé", "passe compose", "au passé composé", "au passe compose"]},
        {nom: "Passé simple", mots: ["passé simple", "passe simple", "au passé simple", "au passe simple"]},
        {nom: "Futur simple", mots: ["futur simple", "au futur", "futur"]},
        {nom: "Imparfait", mots: ["imparfait", "à l'imparfait", "a l imparfait"]},
        {nom: "Présent", mots: ["présent", "present", "au présent", "au present"]}
    ];

    let tempsCible = "Présent";

    for (const temps of tempsDisponibles) {
        if (temps.mots.some(mot => rawSentence.includes(mot))) {
            tempsCible = temps.nom;
            break;
        }
    }

    const motsASupprimer = [
        "conjugue", "conjuguer", "le", "la", "les", "verbe",
        "au", "à", "a", "l'",
        "présent", "present", "imparfait", "futur",
        "simple", "passé", "passe", "composé", "compose"
    ];

    let verbe = rawSentence;

    for (const mot of motsASupprimer) {
        const reg = new RegExp(`(?<=^|\\s)${mot}(?=\\s|$)`, "gi");
        verbe = verbe.replace(reg, " ");
    }

    verbe = verbe.replace(/\s+/g, " ").trim().split(" ")[0];

    if (!verbe) {
        return Avatar.speak("Quel verbe souhaitez-vous conjuguer ?", client,
            () => Avatar.Speech.end(client)
        );
    }

    try {
        info(`Conjugaison : ${verbe} (${tempsCible})`);

        const response = await fetch(`https://leconjugueur.lefigaro.fr/conjugaison/verbe/${encodeURIComponent(verbe)}.html`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok)
            throw new Error(`Erreur HTTP ${response.status}`);

        const html = await response.text();
        const $ = cheerio.load(html);
        let lignes = [];

        $(".tempsBloc").each((i, el) => {
            const titre = $(el).text().trim();
            if (titre.toLowerCase() === tempsCible.toLowerCase()) {
                const $parentClone = $(el).parent().clone();
                $parentClone.find(".tempsBloc").remove();
                $parentClone.find("br").replaceWith("\n");
                const texteNettoye = $parentClone.text().trim();
                
                lignes = texteNettoye.split("\n").map(l => l.trim()).filter(Boolean);
                return false;
            }
        });

        if (!lignes.length)
            throw new Error(`Temps "${tempsCible}" introuvable.`);

        const reponse = `Le verbe ${verbe} au ${tempsCible.toLowerCase()} : ${lignes.join(", ")}.`;

        info(reponse);

        Avatar.speak(reponse, client, () => {
            Avatar.Speech.end(client);
        });

    } catch (err) {
        error("Conjugueur :", err);
        Avatar.speak(`Je n'ai pas trouvé la conjugaison du verbe ${verbe}.`, client,
            () => Avatar.Speech.end(client)
        );
    }
};
