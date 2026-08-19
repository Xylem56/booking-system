/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.createTable('doctors', {
        id: 'id',
        user_id: {type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE'},
        first_name: {type: 'varchar(50)', notNull: true,},
        last_name: {type: 'varchar(50)', notNull: true,},
        specialty: {type: 'varchar(100)', notNull: true,},
        created_at: {type: 'timestamp', notNull: true, default: pgm.func('now()')},

    })

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('doctors')
};
