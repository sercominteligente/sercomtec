-- Preserva o conteúdo institucional existente como base editável no CMS.
UPDATE legal_documents
SET title='Política de Privacidade',
    content='Versão inicial para publicação institucional

Esta política é uma estrutura provisória da política de privacidade da SER comtec. Antes do lançamento comercial definitivo, o conteúdo jurídico deve ser revisado conforme os tratamentos de dados efetivamente utilizados no site, produtos e integrações.

Dados de contato

Para assuntos relacionados à privacidade: atendimento@sercomtec.com.br.

Formulários e atendimento

Os dados informados voluntariamente em formulários e canais de atendimento são utilizados para responder solicitações comerciais, técnicas e de suporte, conforme a finalidade apresentada ao usuário.',
    published=1,
    updated_at=datetime('now'),
    updated_by='migration'
WHERE slug='privacidade';

UPDATE legal_documents
SET title='Termos de Uso',
    content='Versão inicial para publicação institucional

Estes termos são uma estrutura provisória dos termos de uso do site institucional da SER comtec. Os termos específicos dos produtos SERhub, NegocIAJá e SER IA MASTER deverão ser publicados de acordo com as condições comerciais e operacionais de cada serviço.

Uso do site

O site apresenta informações institucionais, produtos, soluções, canais comerciais e suporte. Recursos de inteligência artificial podem produzir respostas automatizadas e não substituem confirmações contratuais, financeiras ou técnicas feitas pelos canais oficiais da empresa.

Contato

Dúvidas: atendimento@sercomtec.com.br.',
    published=1,
    updated_at=datetime('now'),
    updated_by='migration'
WHERE slug='termos';
