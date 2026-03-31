-- Create a function to get policies for a table
CREATE OR REPLACE FUNCTION public.get_table_policies(p_table_name TEXT)
RETURNS TABLE (
    policyname NAME,
    permissive TEXT,
    roles NAME[],
    cmd CHAR,
    qual TEXT,
    with_check TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pol.polname,
        CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        pol.polroles,
        pol.polcmd,
        pg_get_expr(pol.polqual, pol.polrelid),
        pg_get_expr(pol.polwithcheck, pol.polrelid)
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname = p_table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon so we can call it from JS
GRANT EXECUTE ON FUNCTION public.get_table_policies(TEXT) TO anon;
