import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

// טוען טבלה ומאזין לשינויים בזמן אמת. כל שינוי (מכל מכשיר) גורם לטעינה מחדש,
// וגם חזרה לאפליקציה / חיבור מחדש טוענים שוב, כך שלא מפספסים עדכונים.
export function useTable(table, groupId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from(table).select('*').eq('group_id', groupId).order('created_at', { ascending: false });
    if (e) setError(e.message); else { setError(null); setRows(data || []); }
    setLoading(false);
  }, [table, groupId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`rt-${table}-${groupId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe((status) => { if (status === 'SUBSCRIBED') load(); });
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => { supabase.removeChannel(ch); sub.remove(); };
  }, [load, table, groupId]);

  return { rows, loading, error, reload: load };
}
