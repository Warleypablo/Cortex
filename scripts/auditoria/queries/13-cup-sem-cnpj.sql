SELECT id, nome, status, responsavel
FROM "Clickup".cup_clientes
WHERE cnpj IS NULL OR TRIM(cnpj) = ''
ORDER BY nome;
