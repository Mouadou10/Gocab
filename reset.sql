UPDATE Vehicle SET status = 'Actif' WHERE status = 'Accident' AND id NOT IN (SELECT vehicle_id FROM AccidentClaim);
