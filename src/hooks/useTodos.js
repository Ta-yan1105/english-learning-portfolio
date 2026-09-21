import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/* TODO を 1ドキュメント（todos/{uid}）にまとめて保存する。
   { uid, items: [ { id, text, done, cat, createdAt } ] } */
export const useTodos = (user) => {
  const [todos, setTodos] = useState([]);
  const todosRef   = useRef([]);
  const pendingRef = useRef(false); // 保存待ちの間は購読で上書きしない
  const saveTimer  = useRef(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { todosRef.current = []; setTodos([]); return; }
    const ref = doc(db, 'todos', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (pendingRef.current) return;
      const items = snap.exists() ? (snap.data().items || []) : [];
      todosRef.current = items;
      setTodos(items);
    }, () => {});
    return () => unsub();
  }, [user]);

  const commit = useCallback((next) => {
    todosRef.current = next;
    setTodos(next);
    if (!user || user.isAnonymous) return;
    pendingRef.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // merge を使うと消した項目がサーバーに残るため、毎回置き換える
      setDoc(doc(db, 'todos', user.uid), { uid: user.uid, items: next, updatedAt: Date.now() })
        .catch(() => {})
        .finally(() => { pendingRef.current = false; });
    }, 500);
  }, [user]);

  const addTodo    = useCallback((cat = 'english') => commit([...todosRef.current, { id: `t${Date.now()}`, text: '', done: false, cat, createdAt: Date.now() }]), [commit]);
  const updateTodo = useCallback((id, patch) => commit(todosRef.current.map(t => (t.id === id ? { ...t, ...patch } : t))), [commit]);
  const removeTodo = useCallback((id) => commit(todosRef.current.filter(t => t.id !== id)), [commit]);
  const clearDone  = useCallback(() => commit(todosRef.current.filter(t => !t.done)), [commit]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return { todos, addTodo, updateTodo, removeTodo, clearDone };
};
