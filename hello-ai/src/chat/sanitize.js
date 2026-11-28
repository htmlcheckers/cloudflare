export function getHistoricSummary(historicSummary, historicRecent) {
    const lines = [];
    const hasSplitHistory = typeof historicSummary === 'string';
    const summary = hasSplitHistory ? historicSummary.trim() : (typeof historicRecent === 'string' ? historicRecent.trim() : '');
    const recent = hasSplitHistory && typeof historicRecent === 'string' ? historicRecent.trim() : '';
    if (summary) lines.push(` ${JSON.stringify(summary)}.`);
    if (recent) lines.push(` ${JSON.stringify(recent)}.`);
    return lines.join('\n');
}

export function sanitizeMessages(input, limit = 12) {
    if (!Array.isArray(input)) return [];
    const out = [];
    for (const m of input.slice(-limit)) {
        if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
        const content = m.content.trim().slice(0, 600);
        if (!content) continue;
        const last = out[out.length - 1];
        if (last && last.role === m.role) last.content += ' ' + content; // some APIs dislike repeated roles
        else out.push({ role: m.role, content });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out
        .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
        .join('\n');
}

export function cleanReply(text) {
    let t = String(text)
        .replace(/[*_#`>]/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (t.length > 400) {
        const cut = t.slice(0, 400);
        const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
        t = end > 120 ? cut.slice(0, end + 1) : cut;
    }
    return t;
}

export function cleanHistoric(text) {
    return String(text || '')
        .replace(/[*_#`>]/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
