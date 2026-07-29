import os
import re

os.makedirs('supabase/migrations', exist_ok=True)

with open('supabase/exam-portal-sql.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all SQL blocks
# SQL blocks are defined as ("sql", """...""")
sql_blocks = re.findall(r'\("sql",\s*\"\"\"(.*?)\"\"\"\)', content, re.DOTALL)

with open('supabase/migrations/001_initial_schema.sql', 'w', encoding='utf-8') as f:
    f.write("-- AVIORA SQL Architecture - Final Gap Resolution Pass\n\n")
    for block in sql_blocks:
        f.write(block)
        f.write("\n\n")

print("Migration file created at supabase/migrations/001_initial_schema.sql")

# Also update the individual rpc_*.sql files in supabase/ 
# based on the new definitions in the python file.

def extract_and_write_function(name, filename):
    match = re.search(r'CREATE OR REPLACE FUNCTION ' + name + r'\(.*?END;\s*\$\$;', content, re.DOTALL)
    if match:
        with open('supabase/' + filename, 'w', encoding='utf-8') as f:
            f.write(match.group(0) + '\n')
        print(f"Updated {filename}")
    else:
        print(f"Could not find function {name}")

extract_and_write_function('create_exam_session', 'rpc_create_exam_session.sql')
extract_and_write_function('submit_exam_session', 'rpc_submit_exam_session.sql')
extract_and_write_function('compute_and_store_result', 'rpc_compute_and_store_result.sql')
extract_and_write_function('admin_force_submit_session', 'rpc_admin_force_submit_session.sql')
extract_and_write_function('get_exam_report', 'rpc_get_exam_report.sql')
extract_and_write_function('get_leaderboard', 'rpc_get_leaderboard.sql')
extract_and_write_function('expire_stale_sessions', 'rpc_expire_stale_sessions.sql')
extract_and_write_function('update_force_password_change', 'rpc_update_force_password_change.sql')

