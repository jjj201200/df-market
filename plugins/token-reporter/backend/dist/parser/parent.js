export function findParentUser(rec, byUuid) {
    let cur = byUuid.get(rec.parentUuid || '');
    while (cur) {
        if (cur.type === 'user')
            return cur;
        cur = byUuid.get(cur.parentUuid || '');
    }
    return null;
}
