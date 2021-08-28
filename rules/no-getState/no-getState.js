const {
  extractImportedFromEffector,
} = require("../../utils/extract-imported-from-effector");

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Forbids `.getState` calls on any Effector store",
      category: "Quality",
      recommended: true,
    },
    messages: {
      abusiveCall:
        "Method `.getState` called on store `{{ storeName }}` can lead to race conditions. Replace it with `sample` or `guard`.",
    },
    schema: [],
  },
  create(context) {
    const parserServices = context.parserServices;

    return {
      CallExpression(node) {
        const methodName = node.callee?.property?.name;
        if (methodName !== "getState") {
          return;
        }

        const object = traverseNestedObject(node.callee?.object);
        const objectName = object?.name;

        if (!objectName) {
          return;
        }

        // TypeScript-way
        if (parserServices.hasFullTypeInformation) {
          const checker = parserServices.program.getTypeChecker();
          const originalNode = parserServices.esTreeNodeToTSNodeMap.get(object);
          const type = checker.getTypeAtLocation(originalNode);

          const isEffectorStore =
            type?.symbol?.escapedName === "Store" &&
            type?.symbol?.parent?.escapedName?.includes("effector");

          if (!isEffectorStore) {
            return;
          }

          reportGetStateCall({ context, node, storeName: objectName });
        }
        // JavaScript-way
        else {
          const isEffectorStore = objectName.startsWith("$");
          if (!isEffectorStore) {
            return;
          }

          reportGetStateCall({ context, node, storeName: objectName });
        }
      },
    };
  },
};

function reportGetStateCall({ context, node, storeName }) {
  context.report({
    node,
    messageId: "abusiveCall",
    data: {
      storeName,
    },
  });
}

function traverseNestedObject(node) {
  if (node.type === "MemberExpression") {
    return traverseNestedObject(node.property);
  }

  return node;
}