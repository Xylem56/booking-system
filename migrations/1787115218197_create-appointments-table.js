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
    
    pgm.createExtension('btree_gist', { ifNotExists: true });

    pgm.createTable('appointments', {
        id: 'id',
        patient_id: { type: 'integer', notNull: true, references: 'patients', onDelete: 'CASCADE'},
        doctor_id: {type: 'integer', notNull: true, references: 'doctors', onDelete: 'CASCADE'},
        status: { type: 'varchar(50)', notNull: true, default: 'pending' },
        time_range: { type: 'tstzrange', notNull: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
    })


pgm.addConstraint('appointments', 'no_overlapping_appointments', {
    exclude: `USING gist (doctor_id WITH =, time_range WITH && ) WHERE (status = 'accepted')`
})

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('appointments')
};



