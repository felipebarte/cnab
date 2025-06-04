---
description: Guidelines for creating and maintaining Roo Code rules to ensure consistency and effectiveness.
globs: .roo/rules/*.md
alwaysApply: true
---
- **Required Rule Structure:**
  ```markdown
  ---
  description: Clear, one-line description of what the rule enforces
  globs: path/to/files/*.ext, other/path/**/*
  alwaysApply: boolean
  ---

  - **Main Points in Bold**
    - Sub-points with details
    - Examples and explanations
  ```

- **File References:**
  - Use `[filename](mdc:path/to/file)` ([filename](mdc:filename)) to reference files
  - Example: [docker_server_check.md](mdc:.roo/rules/docker_server_check.md) for Docker rules
  - Example: [dev_workflow.md](mdc:.roo/rules/dev_workflow.md) for workflow references
  - Example: [taskmaster.md](mdc:.roo/rules/taskmaster.md) for task management

- **Code Examples:**
  - Use language-specific code blocks
  ```typescript
  // ✅ DO: Show good examples
  const goodExample = true;
  
  // ❌ DON'T: Show anti-patterns
  const badExample = false;
  ```

- **Rule Content Guidelines:**
  - Start with high-level overview
  - Include specific, actionable requirements
  - Show examples of correct implementation
  - Reference existing code when possible
  - Keep rules DRY by referencing other rules

- **Rule Maintenance:**
  - Update rules when new patterns emerge
  - Add examples from actual codebase
  - Remove outdated patterns
  - Cross-reference related rules

- **Best Practices:**
  - Use bullet points for clarity
  - Keep descriptions concise
  - Include both DO and DON'T examples
  - Reference actual code over theoretical examples
  - Use consistent formatting across rules

- **Available Rules:**
  - [docker_server_check.md](mdc:.roo/rules/docker_server_check.md) - Verificação de containers Docker ativos
  - [dev_workflow.mcd](mdc:.roo/rules/dev_workflow.md) - Fluxo de desenvolvimento com Task Master
  - [taskmaster.md](mdc:.roo/rules/taskmaster.md) - Referência de comandos Task Master
  - [self_improve.md](mdc:.roo/rules/self_improve.md) - Melhorias contínuas de regras
  - [component_verification.md](mdc:.roo/rules/component_verification.md) - Verificação obrigatória de componentes existentes 