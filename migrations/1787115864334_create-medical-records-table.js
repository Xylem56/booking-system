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
    pgm.createTable('medical_records', {
        id: 'id',
        patient_id: {type: 'integer', notNull: true, references: 'patients', onDelete: 'CASCADE'},
        doctor_id: {type: 'integer', notNull: true, references: 'doctors', onDelete: 'CASCADE'},
        appointment_id: {type: 'integer', notNull: true, references: 'appointments', onDelete: 'CASCADE'},
        notes: {type: 'text', notNull: true},
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
        
    })
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('medical_records')
};
