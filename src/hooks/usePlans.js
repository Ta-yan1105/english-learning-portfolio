import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/* 日付ごとの予定を 1ドキュメント（plans/{uid}）にまとめて保存する。
   { uid, items: { '2026-09-22': 'メモ', '2026-09-22T09': '9時の予定', ... } } */
export const usePlans = (user) => {
  const [plans, setPlans] = useState({});
  const plansRef  = useRef({});   // 最新の内容（保存用）
  const pendingRef = useRef(false); // 保存待ちの間は購読で上書きしない
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { plansRef.current = {}; setPlans({}); return; }
    const ref = doc(db, 'plans', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      // 自分の保存が反映される前のスナップショットで、消したはずの予定が戻るのを防ぐ
      if (pendingRef.current) return;
      const items = snap.exists() ? (snap.data().items || {}) : {};
      plansRef.current = items;
      setPlans(items);
    }, () => {});
    return () => unsub();
  }, [user]);

  /* 入力のたびに書き込まないよう、少し待ってからまとめて保存する */
  const savePlan = useCallback((key, text) => {
    if (!user || user.isAnonymous) return;

    const next = { ...plansRef.current };
    if (text.trim()) next[key] = text;
    else delete next[key];

    plansRef.current = next;
    setPlans(next);
    pendingRef.current = true;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // merge を使うと入れ子マップが深くマージされ、削除したキーがサーバーに残ってしまう。
      // ドキュメントごと置き換えることで削除を確実に反映する。
      setDoc(doc(db, 'plans', user.uid), { uid: user.uid, items: next, updatedAt: Date.now() })
        .catch(() => {})
        .finally(() => { pendingRef.current = false; });
    }, 500);
  }, [user]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return { plans, savePlan };
};
