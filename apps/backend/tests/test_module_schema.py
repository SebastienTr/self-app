import pytest
from module_schema.models import Model, Template, Type
from pydantic import ValidationError


def _valid_spec(**overrides):
    """Create a valid module spec dict with optional overrides."""
    base = {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Test Module",
        "type": "metric",
        "template": "data-card",
        "dataSources": [],
        "refreshInterval": 3600,
        "schemaVersion": 1,
        "accessibleLabel": "Test module displaying metric data",
        "status": "active",
    }
    base.update(overrides)
    return base


class TestModuleSpecValidation:
    def test_valid_spec_passes(self):
        model = Model(**_valid_spec())
        assert model.name == "Test Module"
        assert model.type == Type.metric

    def test_valid_spec_with_data_sources(self):
        model = Model(
            **_valid_spec(
                dataSources=[
                    {"id": "ds-1", "type": "api", "config": {"url": "https://example.com"}},
                    {"id": "ds-2", "type": "manual"},
                ]
            )
        )
        assert len(model.data_sources) == 2
        assert model.data_sources[0].id == "ds-1"

    def test_missing_name_rejected(self):
        data = _valid_spec()
        del data["name"]
        with pytest.raises(ValidationError):
            Model(**data)

    def test_missing_accessible_label_rejected(self):
        data = _valid_spec()
        del data["accessibleLabel"]
        with pytest.raises(ValidationError):
            Model(**data)

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            Model(**_valid_spec(type="invalid"))

    def test_invalid_template_rejected(self):
        with pytest.raises(ValidationError):
            Model(**_valid_spec(template="invalid"))

    def test_all_type_values_accepted(self):
        for t in Type:
            model = Model(**_valid_spec(type=t.value))
            assert model.type == t

    def test_all_template_values_accepted(self):
        for t in Template:
            model = Model(**_valid_spec(template=t.value))
            assert model.template == t

    def test_schema_version_is_positive_integer(self):
        model = Model(**_valid_spec())
        assert isinstance(model.schema_version, int)
        assert model.schema_version > 0

    def test_zero_refresh_interval_rejected(self):
        with pytest.raises(ValidationError):
            Model(**_valid_spec(refreshInterval=0))

    def test_negative_refresh_interval_rejected(self):
        with pytest.raises(ValidationError):
            Model(**_valid_spec(refreshInterval=-1))

    def test_snake_case_field_access(self):
        """Verify camelCase JSON → snake_case Python field mapping works."""
        model = Model(**_valid_spec())
        assert model.refresh_interval == 3600
        assert model.schema_version == 1
        assert model.accessible_label == "Test module displaying metric data"

    def test_snake_case_input_populates_by_name(self):
        """Generated models should also accept snake_case inputs in Python code."""
        model = Model(
            id="550e8400-e29b-41d4-a716-446655440000",
            name="Test Module",
            type="metric",
            template="data-card",
            data_sources=[],
            refresh_interval=3600,
            schema_version=1,
            accessible_label="Test module displaying metric data",
            status="active",
        )
        assert model.refresh_interval == 3600
        assert model.model_dump(by_alias=True)["refreshInterval"] == 3600

    def test_vitality_score_range(self):
        model = Model(**_valid_spec(vitalityScore=85))
        assert model.vitality_score == 85

    def test_vitality_score_above_100_rejected(self):
        with pytest.raises(ValidationError):
            Model(**_valid_spec(vitalityScore=101))

    def test_vitality_score_below_0_rejected(self):
        with pytest.raises(ValidationError):
            Model(**_valid_spec(vitalityScore=-1))
