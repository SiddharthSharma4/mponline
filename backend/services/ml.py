import os
import joblib
import numpy as np
from abc import ABC, abstractmethod
from sklearn.ensemble import IsolationForest

class AnomalyModelProvider(ABC):
    @abstractmethod
    def load(self):
        pass
    
    @abstractmethod
    def predict(self, features: dict) -> dict:
        pass
        
    @abstractmethod
    def score(self, features: dict) -> float:
        pass
        
    @abstractmethod
    def version(self) -> str:
        pass

class DevelopmentIsolationForestProvider(AnomalyModelProvider):
    def __init__(self, model_path="model_dev.joblib"):
        self.model_path = model_path
        self.model = None
        self._version = "dev-1.0.0"
        self.load()

    def train_dummy(self):
        # Generate some synthetic normal features (e.g. section discrepancies = 0, timing = normal)
        # Features: [q04_discrepancy, evaluation_time_mins, mark_variance]
        X_train = np.random.normal(loc=[0, 15, 2], scale=[0.1, 3, 0.5], size=(100, 3))
        # Add some anomalies
        X_outliers = np.random.normal(loc=[1.5, 3, 10], scale=[0.5, 1, 2], size=(10, 3))
        X = np.vstack([X_train, X_outliers])
        
        clf = IsolationForest(contamination=0.1, random_state=42)
        clf.fit(X)
        joblib.dump(clf, self.model_path)
        self.model = clf
        print("Trained new Development Isolation Forest.")

    def load(self):
        if not os.path.exists(self.model_path):
            self.train_dummy()
        else:
            self.model = joblib.load(self.model_path)

    def extract_features(self, data: dict) -> np.ndarray:
        q04_discrepancy = float(data.get("q04_discrepancy", 0.0))
        eval_time = float(data.get("evaluation_time_mins", 15.0))
        variance = float(data.get("mark_variance", 2.0))
        return np.array([[q04_discrepancy, eval_time, variance]])

    def predict(self, data: dict) -> dict:
        features = self.extract_features(data)
        prediction = self.model.predict(features)[0]  # 1 for normal, -1 for anomaly
        anomaly_score = self.model.decision_function(features)[0]
        
        is_anomaly = prediction == -1
        return {
            "anomaly_score": float(anomaly_score),
            "model_version": self.version(),
            "features": data,
            "severity": "HIGH" if is_anomaly and anomaly_score < -0.1 else "MEDIUM" if is_anomaly else "LOW",
            "review_required": is_anomaly,
            "contributing_signals": ["Q04 discrepancy detected"] if data.get("q04_discrepancy", 0) > 0 else []
        }
        
    def score(self, data: dict) -> float:
        return float(self.model.decision_function(self.extract_features(data))[0])
        
    def version(self) -> str:
        return self._version

class ProductionModelProvider(AnomalyModelProvider):
    """
    Placeholder for a real production model (e.g. loaded from S3 or a model
    registry). Deliberately NOT a silent no-op: previously `predict()` fell
    through to an implicit `return None` whenever a model file happened to
    be present, and `score()` did that unconditionally -- callers expecting
    a dict/float would get None and fail confusingly wherever they tried to
    use it. Now every path either does the real thing or fails loudly and
    explains why, so a misconfigured production deployment can't be mistaken
    for "no anomalies detected".
    """
    def __init__(self, model_path="/models/production.joblib"):
        self.model_path = model_path
        self.model = None
        self.load()

    def load(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)

    def _require_model(self):
        if not self.model:
            raise RuntimeError(
                f"Production anomaly model not found at {self.model_path}. "
                "ENV=production requires a real model artifact; this "
                "deliberately does not fall back to the development model, "
                "so a missing model is never silently mistaken for "
                "'no anomaly'."
            )

    def predict(self, features: dict) -> dict:
        self._require_model()
        raise NotImplementedError(
            "ProductionModelProvider.predict() is not implemented yet -- "
            "wire up the real production model's inference call here."
        )

    def score(self, features: dict) -> float:
        self._require_model()
        raise NotImplementedError(
            "ProductionModelProvider.score() is not implemented yet -- "
            "wire up the real production model's inference call here."
        )

    def version(self) -> str:
        return "prod-v1"

def get_anomaly_detector() -> AnomalyModelProvider:
    if os.environ.get("ENV") == "production":
        return ProductionModelProvider()
    return DevelopmentIsolationForestProvider()
