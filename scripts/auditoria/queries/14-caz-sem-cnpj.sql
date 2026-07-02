SELECT id, nome, empresa
FROM "Conta Azul".caz_clientes
WHERE cnpj IS NULL OR TRIM(cnpj) = ''
ORDER BY nome;
