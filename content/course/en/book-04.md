> **The question:** As records accumulate, can you explain every number and how duplicates and missing values are handled?

**Before you begin:** Understand objects, arrays, validation and basic Git. Distinguish raw data from calculated results.

### Concepts and learning objectives
Use local SQLite or a familiar relational database. Define what one row means before drawing relationships. Learn primary and foreign keys, non-null and unique constraints, filters, sorting, aggregation and joins. Keep zero, unknown and not applicable distinct. Mixing data at different grains is often more dangerous than SQL syntax.

Start with two entities: tasks and runs. A task can have multiple runs, including failures. Understand transactions and migrations: related writes must not half-succeed, and schema changes need a version and recovery path. Use synthetic data rather than building a cloud analytics platform.

### Reading and selected sections
@readings
R18|Required|Filtering, sorting and aggregation; compare results with hand calculations.|45
R19|Required|Keys, constraints and table relationships.|45
R17|Optional|Joins in Relating; writes and transactions in Writing.|30
@end

### Studio lab
1. Draw two tables and define one row in each. Make a small synthetic dataset with duplicates, missing values and failures; hand-calculate several query answers.
2. Write schema and seed scripts. Insert invalid data deliberately and confirm both database rejection and an understandable application error.
3. Query unfinished tasks, actual runs by category and elapsed time for records with known values. Keep failed and unknown outcomes separate and state the success-rate denominator.
4. Add a status field through a migration. Back up, migrate, verify and restore; a successful command exit alone is not proof.
5. Write a minimal data dictionary: meaning, unit, null semantics, provenance and retention. Remove fields with no actual purpose.

### Deliverables and acceptance
| Deliverable | Evidence of completion |
|---|---|
| Schema and migration | Constraints actually trigger and a local backup is restored. |
| Three verifiable queries | Results match manual calculations; joins do not unexpectedly multiply rows. |
| Data dictionary | Grain, source, units and missingness are explicit. |

**Independent exercise:** Write a query finding tasks with a failed run and no later success. Establish the answer on paper first.

**Privacy and safety:** Database files, backups and CSV exports can all contain sensitive information. Publish synthetic seeds only. Parameterise queries and keep backups out of public static directories.

**Everyday use:** Add just enough structured history to locate frequent failures, rather than collecting a full record of your life.

**Pass or revisit:** Explain join behaviour and aggregation denominators and recognise duplicate writes. Displaying missing information as zero fails this checkpoint.

### A reusable collaboration prompt
```text
First review what one row means, then design minimal relational tables and constraints. Use synthetic records, three manually checkable queries and a reversible migration. Do not connect a cloud database or use real personal or work records as seeds.
```
