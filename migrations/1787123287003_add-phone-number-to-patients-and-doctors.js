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
    pgm.addColumns('patients', {
        phone_number: { type: 'varchar(20)', notNull: true }
    })
    pgm.addColumns('doctors', {
        phone_number: { type: 'varchar(20)', notNull: true }
    })
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('patients', ['phone_number']);
    pgm.dropColumns('doctors', ['phone_number']);
};
