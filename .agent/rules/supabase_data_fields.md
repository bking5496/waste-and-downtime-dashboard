# Supabase Data Field Rule

## Rule

**Every input or data field created in this project MUST have a corresponding column/place in Supabase.**

## Requirements

1. **Before creating any new input field or data field** in the UI or application code, ensure:
   - A corresponding column exists in the appropriate Supabase table
   - If the column doesn't exist, create a migration to add it first

2. **When adding new form fields or data inputs**:
   - Identify the target Supabase table
   - Verify the column exists with the correct data type
   - If not, create or update the table schema before implementing the UI

3. **Data field checklist**:
   - [ ] Column exists in Supabase table
   - [ ] Column has appropriate data type (text, integer, boolean, timestamp, etc.)
   - [ ] Column has appropriate constraints (nullable, unique, default values)
   - [ ] Column is included in relevant Row Level Security (RLS) policies if needed

4. **Migration best practices**:
   - Create migration files in `supabase/migrations/` for schema changes
   - Use descriptive migration names (e.g., `add_operator_notes_column.sql`)
   - Test migrations locally before applying to production

## Enforcement

- Always check the Supabase schema before implementing new data fields
- Never create "orphan" input fields that don't persist to the database
- Document any new columns added to the schema
