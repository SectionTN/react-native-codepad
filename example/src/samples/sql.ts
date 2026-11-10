export const sql = `-- A school database in MySQL.
CREATE TABLE classe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(20) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE eleve (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(50) NOT NULL,
  moyenne DECIMAL(4, 2) DEFAULT 0,
  classe_id INT,
  FOREIGN KEY (classe_id) REFERENCES classe (id)
);

INSERT INTO classe (nom) VALUES ('4 SI 1'), ('4 SI 2');
INSERT INTO eleve (nom, moyenne, classe_id)
VALUES ('Amira', 17.5, 1), ('Youssef', 14.25, 1), ('Nour', 9.75, 2);

/* Average per class, best first */
SELECT c.nom, COUNT(e.id) AS eleves, AVG(e.moyenne) AS moyenne
FROM eleve e
INNER JOIN classe c ON c.id = e.classe_id
WHERE e.moyenne >= 10
GROUP BY c.nom
ORDER BY moyenne DESC;

update eleve set moyenne = moyenne + 0.5 where nom like 'N%';
DELETE FROM eleve WHERE moyenne < 5;
`;
