#!/bin/sh

# Check not committing to master
BRANCH=$(env LANG=C git symbolic-ref --short HEAD 2>/dev/null || $git_eng describe --tags --always 2>/dev/null)
[ "$BRANCH" == "master" ] && echo "Please don't commit to master" && exit 1

# Ensure all javascript files staged for commit pass standard code style
npm run lint-files-to-commit
[ $? -eq 1 ] && exit 1

# Run tests if linting is ok
git stash -q --keep-index
npm run test
EXITSTATUS=$?
git stash pop -q

exit $EXITSTATUS
