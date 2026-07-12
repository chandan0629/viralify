with open("backend/models/predict_main.py", "r") as f:
    content = f.read()

content = content.replace("test_features[feature] = test_val", "test_features[feature] = test_val\n                # print(f\"Testing {feature}={test_val} -> {new_pred}\")")
content = content.replace("if improvement > best_improvement:", "logger.info(f\"Feature {feature} at {test_val}: prob={test_prob}, impr={improvement}\")\n                    if improvement > best_improvement:")

with open("backend/models/predict_main.py", "w") as f:
    f.write(content)
