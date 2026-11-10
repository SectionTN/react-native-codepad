export const php = `<?php
/**
 * The student list page.
 */
$title = "Class 4 SI";
$students = [
  ['name' => 'Amira', 'grade' => 17.5],
  ['name' => 'Youssef', 'grade' => 14],
];
$passed = count(array_filter($students, fn ($s) => $s['grade'] >= 10));
?>
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title><?= $title ?></title>
  </head>
  <body>
    <h1 class="title"><?= $title ?></h1>
    <table>
      <?php foreach ($students as $student): ?>
        <tr>
          <td><?= htmlspecialchars($student['name']) ?></td>
          <td class="grade"><?= $student['grade'] ?></td>
        </tr>
      <?php endforeach; ?>
    </table>
    <?php if ($passed > 0) { ?>
      <p><?= $passed ?> students passed.</p>
    <?php } ?>
    <?php
    echo <<<HTML
      <footer><a href="index.php">Back</a></footer>
    HTML;
    ?>
  </body>
</html>
`;
