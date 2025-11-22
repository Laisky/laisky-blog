# Repository Guidelines

## Package Management

Use `yarn` for managing packages. Avoid using `npm` to prevent potential conflicts in the `yarn.lock` file.

## Dev

You can start the test server with `make run`; any code changes will be automatically refreshed.

After the test server starts, you can access http://100.75.198.70:11300/ via Chrome DevTools MCP.

Prefer to work with tabs that are already open and try not to open new ones. My network can be unstable, and loading a fresh page often takes excessive time.

If you come across a page that requires logging in or any other manual steps before you can proceed, please notify me. I’ll perform the necessary actions and then let you continue.

## General

### Agents

Multiple agents might be modifying the code at the same time. If you come across changes that aren't yours, preserve them and avoid interfering with other agents' work. Only halt the task and inform me when you encounter an irreconcilable conflict.

### TimeZone

Always use UTC for time handling in servers, databases, and APIs.

### Date Range

For any date‑range query, the handling of the ending date must encompass the entire final day. That means the database query should terminate **just before** 00:00 on the next day, ensuring that all hours of the last day are included.

### Testing

Please create suitable unit tests based on the current project circumstances. Whenever a new issue arises, update the unit tests during the fix to ensure thorough coverage of the problem by the test cases. Avoid creating temporary, one-off test scripts, and focus on continuously enhancing the unit test cases.

### Comments

Every function/interface must have a comment explaining its purpose, parameters, and return values. This is crucial for maintaining code clarity and facilitating future maintenance.
The comment should start with the function/interface name and be in complete sentences.

## CSS Style

Avoid using `!important` in CSS. If you find yourself needing to use it, consider whether the CSS can be refactored to avoid this necessity.

Avoid inline styles in HTML or JSX. Instead, use CSS classes to manage styles. This approach promotes better maintainability and separation of concerns in your codebase.

## Web

When using the web console for debugging, avoid logging objects—they’re hard to copy. Strive to log only strings, making it simple for me to copy all the output and analyze it.
